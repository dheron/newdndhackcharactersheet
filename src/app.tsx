import { useEffect, useState } from "preact/hooks";
import { Creation } from "./creation/Creation";
import type { Character } from "./model/character";
import { Sheet } from "./sheet/Sheet";
import { LIBRARY_FOLDER, backupText, deleteCharacter, duplicateCharacter, importCharacters, listCharacters, loadCharacter, syncWithDrive, type CharacterSummary } from "./library";
import { inTauri, saveTextAs } from "./storage";
import * as drive from "./sync/drive";
import { SpellInfoProvider } from "./spells/SpellInfo";
import { APP_VERSION, BUILD_ID } from "./version";

type Screen = { kind: "home" } | { kind: "create" } | { kind: "sheet"; character: Character };

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function App() {
  return (
    <SpellInfoProvider>
      <Screens />
    </SpellInfoProvider>
  );
}

function Screens() {
  const [screen, setScreen] = useState<Screen>({ kind: "home" });
  const home = () => setScreen({ kind: "home" });

  if (screen.kind === "sheet") return <Sheet key={screen.character.id} initial={screen.character} onClose={home} />;

  return (
    <main class="shell">
      <header class="app-header">
        <h1>{screen.kind === "create" ? "New character" : "Characters"}</h1>
        <span class="version">
          Version {APP_VERSION} ({BUILD_ID})
        </span>
      </header>
      {screen.kind === "home" && <CharacterList onOpen={(character) => setScreen({ kind: "sheet", character })} onNew={() => setScreen({ kind: "create" })} />}
      {screen.kind === "create" && (
        <>
          <Creation onFinish={(character) => setScreen({ kind: "sheet", character })} />
          <div class="actions">
            <button type="button" onClick={() => window.confirm("Leave this character unfinished?") && home()}>
              Cancel
            </button>
          </div>
        </>
      )}
    </main>
  );
}

function CharacterList({ onOpen, onNew }: { onOpen: (c: Character) => void; onNew: () => void }) {
  const [list, setList] = useState<CharacterSummary[] | null>(null);
  const [unreadable, setUnreadable] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [connected, setConnected] = useState(drive.driveConnected());
  const [syncing, setSyncing] = useState(false);
  const [driveNote, setDriveNote] = useState("");

  /** Syncs with Google Drive. Interactive (a tap) may open Google sign-in; otherwise it uses this visit's sign-in only. */
  const sync = async (interactive: boolean) => {
    setSyncing(true);
    setError("");
    try {
      const r = await syncWithDrive(interactive);
      setConnected(true);
      const changes = r.uploaded + r.downloaded + r.deleted;
      setDriveNote(changes ? `synced (${r.downloaded} in, ${r.uploaded} out${r.deleted ? `, ${r.deleted} deleted` : ""})` : "up to date");
      await refresh();
    } catch (e) {
      if (e instanceof drive.NeedsSignIn) setDriveNote("tap Sync now to sign in again");
      else setError(`Google Drive: ${message(e)}`);
    } finally {
      setSyncing(false);
    }
  };

  const refresh = () =>
    listCharacters()
      .then((r) => {
        setList(r.characters);
        setUnreadable(r.unreadable);
      })
      .catch((e) => {
        setList([]);
        setError(`Could not read the character library: ${message(e)}`);
      });

  useEffect(() => {
    refresh();
    // Catch up with Drive when the list opens, if already signed in during this visit.
    if (drive.driveAvailable() && drive.driveConnected()) sync(false);
  }, []);

  const run = async (fn: () => Promise<unknown>) => {
    setError("");
    setNote("");
    try {
      await fn();
    } catch (e) {
      setError(message(e));
    }
  };

  return (
    <div class="library">
      <div class="actions top">
        <button type="button" class="primary" onClick={onNew}>
          New character
        </button>
        <button
          type="button"
          onClick={() =>
            run(async () => {
              const brought = await importCharacters();
              if (brought.length === 1) return onOpen(brought[0]!);
              setNote(brought.length ? `Brought in ${brought.length} characters.` : "Nothing new to bring in: those characters are already here and up to date.");
              await refresh();
            })
          }
        >
          Import
        </button>
        <button
          type="button"
          onClick={() =>
            run(async () => {
              const saved = await saveTextAs(`Characters backup ${new Date().toISOString().slice(0, 10)}.json`, await backupText());
              if (saved) setNote(`Backed up every character to ${saved.label}.`);
            })
          }
        >
          Back up all characters
        </button>
      </div>
      <p class="hint">
        {inTauri()
          ? `Characters are kept in the "${LIBRARY_FOLDER}" folder in your Documents and save as you play.`
          : "Characters are kept in this browser on this device and save as you play. Back up all characters (or Export one from its sheet) to save a file you can keep or move to another device; Import brings files back in."}
      </p>
      {drive.driveAvailable() && (
        <div class="drive">
          {connected ? (
            <>
              <span>Google Drive: {syncing ? "syncing..." : driveNote || "connected"}</span>
              <button type="button" disabled={syncing} onClick={() => sync(true)}>
                Sync now
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!window.confirm("Stop syncing with Google Drive on this device? Characters stay here and in your Drive.")) return;
                  drive.disconnectDrive();
                  setConnected(false);
                  setDriveNote("");
                }}
              >
                Disconnect
              </button>
            </>
          ) : (
            <>
              <span>Keep your characters in Google Drive and use them on every device.</span>
              <button type="button" class="primary" onClick={() => sync(true)}>
                Connect Google Drive
              </button>
            </>
          )}
        </div>
      )}
      {note && (
        <p class="status" role="status">
          {note}
        </p>
      )}
      {error && (
        <p class="status" role="alert">
          {error}
        </p>
      )}
      {list === null ? (
        <p>Loading...</p>
      ) : list.length === 0 ? (
        <p>No characters yet.</p>
      ) : (
        <ul class="char-list">
          {list.map((ch) => (
            <li key={ch.id}>
              <button type="button" class="char-open" onClick={() => run(async () => onOpen(await loadCharacter(ch.id)))}>
                <span class="char-name">{ch.name}</span>
                <span class="char-meta">
                  {ch.race} {ch.classAndLevel}
                </span>
              </button>
              <button type="button" onClick={() => run(async () => (await duplicateCharacter(ch.id), refresh()))}>
                Duplicate
              </button>
              <button
                type="button"
                onClick={() => window.confirm(`Delete ${ch.name}? This cannot be undone.`) && run(async () => (await deleteCharacter(ch.id), refresh()))}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
      {unreadable.length > 0 && <p class="note">These files in the folder could not be read: {unreadable.join(", ")}</p>}
    </div>
  );
}
