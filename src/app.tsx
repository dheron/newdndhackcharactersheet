import { Creation } from "./creation/Creation";
import { APP_VERSION } from "./version";

// Phase 2: character creation. The playable sheet and character list come in later phases.
export function App() {
  return (
    <main class="shell">
      <header class="app-header">
        <h1>New character</h1>
        <span class="version">Version {APP_VERSION}</span>
      </header>
      <Creation />
    </main>
  );
}
