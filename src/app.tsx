import { useEffect, useState } from "preact/hooks";
import { Creation } from "./creation/Creation";
import type { Character } from "./model/character";
import { Sheet } from "./sheet/Sheet";
import { LIBRARY_FOLDER, deleteCharacter, duplicateCharacter, importCharacter, listCharacters, loadCharacter, type CharacterSummary } from "./library";
import { inTauri } from "./storage";
import { APP_VERSION } from "./version";

type Screen = { kind: "home" } | { kind: "create" } | { kind: "sheet"; character: Character };

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function App() {
  const [screen, setScreen] = useState<Screen>({ kind: "home" });
  const home = () => setScreen({ kind: "home" });

  if (screen.kind === "sheet") return <Sheet key={screen.character.id} initial={screen.character} onClose={home} />;

  return (
    <main class="shell">
      <header class="app-header">
        <h1>{screen.kind === "create" ? "New character" : "Characters"}</h1>
        <span class="version">Version {APP_VERSION}</span>
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
  }, []);

  const run = async (fn: () => Promise<unknown>) => {
    setError("");
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
              const c = await importCharacter();
              if (c) onOpen(c);
            })
          }
        >
          Import a file
        </button>
      </div>
      <p class="hint">
        {inTauri()
          ? `Characters are kept in the "${LIBRARY_FOLDER}" folder in your Documents and save as you play.`
          : "Characters are kept in this browser on this device. Use Export on a sheet to back one up or move it to another device, and Import a file to bring it in."}
      </p>
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
