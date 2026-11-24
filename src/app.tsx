import { useState } from "preact/hooks";
import { Creation } from "./creation/Creation";
import type { Character } from "./model/character";
import { Sheet } from "./sheet/Sheet";
import { openCharacterFile, type FilePath } from "./storage";
import { APP_VERSION } from "./version";

type Screen = { kind: "home" } | { kind: "create" } | { kind: "sheet"; character: Character; path: FilePath };

export function App() {
  const [screen, setScreen] = useState<Screen>({ kind: "home" });
  const [error, setError] = useState("");
  const home = () => setScreen({ kind: "home" });

  const open = async () => {
    setError("");
    try {
      const opened = await openCharacterFile();
      if (opened) setScreen({ kind: "sheet", character: opened.character, path: opened.path });
    } catch (e) {
      setError(`Could not open that file: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  if (screen.kind === "sheet") return <Sheet key={screen.character.id} initial={screen.character} path={screen.path} onClose={home} />;

  return (
    <main class="shell">
      <header class="app-header">
        <h1>{screen.kind === "create" ? "New character" : "Character Sheet"}</h1>
        <span class="version">Version {APP_VERSION}</span>
      </header>
      {screen.kind === "home" && (
        <div class="home">
          <button type="button" class="primary" onClick={() => setScreen({ kind: "create" })}>
            New character
          </button>
          <button type="button" onClick={open}>
            Open character
          </button>
          {error && (
            <p class="status" role="alert">
              {error}
            </p>
          )}
        </div>
      )}
      {screen.kind === "create" && (
        <>
          <Creation onFinish={(character, path) => setScreen({ kind: "sheet", character, path })} />
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
