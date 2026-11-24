// The character library. In the desktop app every character is a file in the "Character Sheets"
// folder in Documents, saved as the player plays (David). In the web version the characters live
// in the browser's storage on that device, and, once connected, are synced with a "Character
// Sheets" folder in the player's Google Drive (src/sync).
import { charactersFromText, fileNameFor, fromFileText, newId, toBackupText, toFileText, type Character } from "./model/character";
import { planSync } from "./sync/merge";
import * as drive from "./sync/drive";
import { classAndLevel } from "./sheet/derived";
import { inTauri, openTextFile } from "./storage";

export const LIBRARY_FOLDER = "Character Sheets";
const BROWSER_PREFIX = "character-sheets:";

export interface CharacterSummary {
  id: string;
  name: string;
  race: string;
  classAndLevel: string;
}

/** One file per character, named after the character and the start of its id so names can repeat. */
export function libraryFileName(c: Character): string {
  return fileNameFor(c).replace(/\.character\.json$/, ` ${c.id.slice(0, 8)}.character.json`);
}

const summary = (c: Character): CharacterSummary => ({ id: c.id, name: c.name, race: c.race, classAndLevel: classAndLevel(c) });

async function fs() {
  const mod = await import("@tauri-apps/plugin-fs");
  const opts = { baseDir: mod.BaseDirectory.Document };
  if (!(await mod.exists(LIBRARY_FOLDER, opts))) await mod.mkdir(LIBRARY_FOLDER, { ...opts, recursive: true });
  return { mod, opts };
}

/** Every character in the library, read fresh from disk, sorted by name. Files that cannot be read are skipped and named. */
export async function listCharacters(): Promise<{ characters: CharacterSummary[]; unreadable: string[] }> {
  const characters: CharacterSummary[] = [];
  const unreadable: string[] = [];
  for (const { key, text } of await readAll()) {
    try {
      characters.push(summary(fromFileText(text)));
    } catch {
      unreadable.push(key);
    }
  }
  characters.sort((a, b) => a.name.localeCompare(b.name));
  return { characters, unreadable };
}

async function readAll(): Promise<{ key: string; text: string }[]> {
  if (!inTauri()) {
    const keys = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)).filter((k): k is string => k?.startsWith(BROWSER_PREFIX) ?? false);
    return keys.map((k) => ({ key: k, text: localStorage.getItem(k) ?? "" }));
  }
  const { mod, opts } = await fs();
  const entries = await mod.readDir(LIBRARY_FOLDER, opts);
  const files = entries.filter((e) => e.isFile && e.name.endsWith(".character.json"));
  return Promise.all(files.map(async (e) => ({ key: e.name, text: await mod.readTextFile(`${LIBRARY_FOLDER}/${e.name}`, opts) })));
}

/** Finds a character's file by id (the file name can change if the player renames them later). */
async function keyFor(id: string): Promise<string | null> {
  for (const { key, text } of await readAll()) {
    try {
      if (fromFileText(text).id === id) return key;
    } catch {
      // Skip files that are not characters.
    }
  }
  return null;
}

export async function loadCharacter(id: string): Promise<Character> {
  const key = await keyFor(id);
  if (!key) throw new Error("That character is no longer in the library.");
  if (!inTauri()) return fromFileText(localStorage.getItem(key) ?? "");
  const { mod, opts } = await fs();
  return fromFileText(await mod.readTextFile(`${LIBRARY_FOLDER}/${key}`, opts));
}

/** Writes a character's file as it is (keeping its save time). */
async function writeLocal(c: Character): Promise<void> {
  if (!inTauri()) {
    localStorage.setItem(BROWSER_PREFIX + c.id, toFileText(c));
    return;
  }
  const { mod, opts } = await fs();
  await mod.writeTextFile(`${LIBRARY_FOLDER}/${libraryFileName(c)}`, toFileText(c), opts);
}

export type DriveResult = "off" | "saved" | "later";

/**
 * Saves a character on this device, stamped with the time, and to Google Drive when the web
 * version is connected and signed in. "later": Drive will catch up at the next sync.
 */
export async function saveCharacter(c: Character): Promise<DriveResult> {
  const stamped = { ...c, updatedAt: new Date().toISOString() };
  await writeLocal(stamped);
  if (!drive.driveAvailable() || !drive.driveConnected()) return "off";
  try {
    await pushToDrive(stamped);
    return "saved";
  } catch {
    return "later";
  }
}

// Which Drive file holds each character on this device's last sync.
const FILES_KEY = "drive:files";
const fileIds = () => JSON.parse(localStorage.getItem(FILES_KEY) ?? "{}") as Record<string, string>;
const setFileIds = (m: Record<string, string>) => localStorage.setItem(FILES_KEY, JSON.stringify(m));

async function pushToDrive(c: Character): Promise<void> {
  const ids = fileIds();
  ids[c.id] = await drive.upload({ id: c.id, name: libraryFileName(c), updatedAt: c.updatedAt ?? "" }, toFileText(c), ids[c.id]);
  setFileIds(ids);
  const synced = drive.syncedIds();
  synced.add(c.id);
  drive.setSyncedIds(synced);
}

/** Brings this device and Google Drive up to date with each other. `interactive` may open Google sign-in. */
export async function syncWithDrive(interactive: boolean): Promise<{ uploaded: number; downloaded: number; deleted: number }> {
  if (interactive) await drive.connectDrive();
  const remote = await drive.listRemote(interactive);
  const local: Character[] = [];
  for (const { text } of await readAll()) {
    try {
      local.push(fromFileText(text));
    } catch {
      // Unreadable files are listed on the start screen and left alone.
    }
  }
  const plan = planSync(
    local.map((c) => ({ id: c.id, updatedAt: c.updatedAt ?? "" })),
    remote,
    drive.syncedIds(),
    drive.deletedIds(),
  );
  const ids = Object.fromEntries(remote.map((r) => [r.id, r.fileId]));
  for (const id of plan.upload) {
    const c = local.find((x) => x.id === id)!;
    ids[id] = await drive.upload({ id, name: libraryFileName(c), updatedAt: c.updatedAt ?? "" }, toFileText(c), ids[id]);
  }
  for (const r of plan.download) await writeLocal(fromFileText(await drive.download(r.fileId)));
  for (const id of plan.deleteLocal) await removeLocal(id);
  for (const r of plan.deleteRemote) {
    await drive.remove(r.fileId);
    delete ids[r.id];
  }
  setFileIds(ids);
  drive.setSyncedIds(new Set(Object.keys(ids)));
  drive.setDeletedIds(new Set());
  return { uploaded: plan.upload.length, downloaded: plan.download.length, deleted: plan.deleteLocal.length + plan.deleteRemote.length };
}

export async function deleteCharacter(id: string): Promise<void> {
  await removeLocal(id);
  drive.noteDeleted(id);
  if (drive.driveConnected()) await syncWithDrive(false).catch(() => undefined);
}

async function removeLocal(id: string): Promise<void> {
  const key = await keyFor(id);
  if (!key) return;
  if (!inTauri()) {
    localStorage.removeItem(key);
    return;
  }
  const { mod, opts } = await fs();
  await mod.remove(`${LIBRARY_FOLDER}/${key}`, opts);
}

/** A copy with a new id and "(copy)" after the name. */
export function copyOf(c: Character, name = `${c.name} (copy)`): Character {
  return { ...structuredClone(c), id: newId(), createdAt: new Date().toISOString(), name };
}

export async function duplicateCharacter(id: string): Promise<Character> {
  const copy = copyOf(await loadCharacter(id));
  await saveCharacter(copy);
  return copy;
}

/**
 * Brings characters from a file anywhere into the library: one character file, or a backup of
 * several. A character already here is replaced by the file's copy only if the file's is newer.
 */
export async function importCharacters(): Promise<Character[]> {
  const text = await openTextFile();
  if (text === null) return [];
  const incoming = charactersFromText(text);
  const brought: Character[] = [];
  for (const c of incoming) {
    const key = await keyFor(c.id);
    if (key) {
      const here = await loadCharacter(c.id);
      if ((c.updatedAt ?? "") <= (here.updatedAt ?? "")) continue;
    }
    await saveCharacter(c);
    brought.push(c);
  }
  return brought;
}

/** Every character in one backup file ("Back up all characters"). */
export async function backupText(): Promise<string> {
  const all: Character[] = [];
  for (const { text } of await readAll()) {
    try {
      all.push(fromFileText(text));
    } catch {
      // Skip files that are not characters.
    }
  }
  return toBackupText(all);
}
