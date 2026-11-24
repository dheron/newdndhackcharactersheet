// Google Drive sync for the web version. Characters are saved as files in a "Character Sheets"
// folder in the player's Drive. The app asks only for the drive.file permission: it can see and
// change only the files it created itself, nothing else in the Drive.
//
// Sign-in uses Google Identity Services in the browser. Google gives a browser app an access
// token for about an hour and no lasting sign-in, so on a new visit the player taps "Sync" once
// (Google remembers the consent, so it is one tap). Setup: docs/google-drive-setup.md.
import { inTauri } from "../storage";
import type { RemoteEntry } from "./merge";

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
const SCOPE = "https://www.googleapis.com/auth/drive.file";
const FOLDER = "Character Sheets";
const API = "https://www.googleapis.com/drive/v3";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3";

/** Drive sync is offered on the web version when a Google client ID was built in. */
export const driveAvailable = () => !inTauri() && Boolean(CLIENT_ID);

// What this device remembers about Drive (in browser storage).
const KEY = {
  connected: "drive:connected",
  folder: "drive:folder",
  synced: "drive:synced",
  deleted: "drive:deleted",
};
const readSet = (k: string) => new Set<string>(JSON.parse(localStorage.getItem(k) ?? "[]") as string[]);
const writeSet = (k: string, s: Set<string>) => localStorage.setItem(k, JSON.stringify([...s]));

export const driveConnected = () => localStorage.getItem(KEY.connected) === "1";
export const syncedIds = () => readSet(KEY.synced);
export const setSyncedIds = (s: Set<string>) => writeSet(KEY.synced, s);
export const deletedIds = () => readSet(KEY.deleted);
export const setDeletedIds = (s: Set<string>) => writeSet(KEY.deleted, s);

/** Remember a character deleted on this device, so the next sync deletes its Drive copy too. */
export function noteDeleted(id: string) {
  if (!driveConnected()) return;
  const s = deletedIds();
  s.add(id);
  setDeletedIds(s);
}

// --- Google Identity Services ---------------------------------------------------------------

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
}
interface TokenClient {
  callback: (r: TokenResponse) => void;
  requestAccessToken: (o?: { prompt?: string }) => void;
}
declare global {
  interface Window {
    google?: { accounts: { oauth2: { initTokenClient: (o: { client_id: string; scope: string; callback: (r: TokenResponse) => void }) => TokenClient; revoke: (t: string, done: () => void) => void } } };
  }
}

let token: { value: string; expires: number } | null = null;
let client: TokenClient | null = null;

function loadGis(): Promise<void> {
  if (window.google?.accounts) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Could not reach Google. Check the internet connection."));
    document.head.appendChild(s);
  });
}

export class NeedsSignIn extends Error {
  constructor() {
    super("Tap Sync to sign in to Google Drive again.");
  }
}

/** An access token. Without `interactive`, only a token from earlier in this visit is used. */
async function accessToken(interactive: boolean): Promise<string> {
  if (token && Date.now() < token.expires - 60_000) return token.value;
  if (!interactive) throw new NeedsSignIn();
  await loadGis();
  const g = window.google!.accounts.oauth2;
  return new Promise((resolve, reject) => {
    client ??= g.initTokenClient({ client_id: CLIENT_ID!, scope: SCOPE, callback: () => undefined });
    client.callback = (r) => {
      if (r.error || !r.access_token) return reject(new Error(r.error === "access_denied" ? "Google Drive access was not allowed." : "Google sign-in did not finish."));
      token = { value: r.access_token, expires: Date.now() + (r.expires_in ?? 3600) * 1000 };
      localStorage.setItem(KEY.connected, "1");
      resolve(token.value);
    };
    // Google shows the consent screen the first time only; after that the pop-up closes by itself.
    client.requestAccessToken({ prompt: driveConnected() ? "" : "consent" });
  });
}

export async function connectDrive(): Promise<void> {
  await accessToken(true);
}

export function disconnectDrive() {
  if (token && window.google) window.google.accounts.oauth2.revoke(token.value, () => undefined);
  token = null;
  for (const k of Object.values(KEY)) localStorage.removeItem(k);
}

// --- Drive files ---------------------------------------------------------------------------

async function call(path: string, init: RequestInit = {}, interactive = false, base = API): Promise<Response> {
  const t = await accessToken(interactive);
  const r = await fetch(`${base}${path}`, { ...init, headers: { ...(init.headers ?? {}), Authorization: `Bearer ${t}` } });
  if (r.status === 401) {
    token = null;
    throw new NeedsSignIn();
  }
  if (!r.ok) throw new Error(`Google Drive said ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r;
}

async function folderId(interactive: boolean): Promise<string> {
  const known = localStorage.getItem(KEY.folder);
  if (known) return known;
  const q = encodeURIComponent(`name='${FOLDER}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
  const found = (await (await call(`/files?q=${q}&fields=files(id)`, {}, interactive)).json()) as { files: { id: string }[] };
  const id =
    found.files[0]?.id ??
    ((await (
      await call("/files?fields=id", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: FOLDER, mimeType: "application/vnd.google-apps.folder" }) }, interactive)
    ).json()) as { id: string }).id;
  localStorage.setItem(KEY.folder, id);
  return id;
}

/** Every character file the app has in the Drive folder, with the character id and save time it was tagged with. */
export async function listRemote(interactive = false): Promise<RemoteEntry[]> {
  const folder = await folderId(interactive);
  const out: RemoteEntry[] = [];
  let page = "";
  do {
    const q = encodeURIComponent(`'${folder}' in parents and trashed=false`);
    const r = (await (await call(`/files?q=${q}&fields=nextPageToken,files(id,appProperties)&pageSize=200${page ? `&pageToken=${page}` : ""}`, {}, interactive)).json()) as {
      nextPageToken?: string;
      files: { id: string; appProperties?: { characterId?: string; updatedAt?: string } }[];
    };
    for (const f of r.files) if (f.appProperties?.characterId) out.push({ id: f.appProperties.characterId, fileId: f.id, updatedAt: f.appProperties.updatedAt ?? "" });
    page = r.nextPageToken ?? "";
  } while (page);
  return out;
}

export async function download(fileId: string): Promise<string> {
  return (await call(`/files/${fileId}?alt=media`)).text();
}

/** Creates or replaces a character's file. */
export async function upload(meta: { id: string; name: string; updatedAt: string }, text: string, fileId?: string): Promise<string> {
  const folder = await folderId(false);
  const boundary = "character-sheet-boundary";
  const metadata = {
    name: meta.name,
    mimeType: "application/json",
    appProperties: { characterId: meta.id, updatedAt: meta.updatedAt },
    ...(fileId ? {} : { parents: [folder] }),
  };
  const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${text}\r\n--${boundary}--`;
  const r = await call(
    fileId ? `/files/${fileId}?uploadType=multipart&fields=id` : "/files?uploadType=multipart&fields=id",
    { method: fileId ? "PATCH" : "POST", headers: { "Content-Type": `multipart/related; boundary=${boundary}` }, body },
    false,
    UPLOAD,
  );
  return ((await r.json()) as { id: string }).id;
}

export async function remove(fileId: string): Promise<void> {
  await call(`/files/${fileId}`, { method: "DELETE" });
}
