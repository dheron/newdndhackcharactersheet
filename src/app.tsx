import { APP_VERSION } from "./version";

// Phase 0 shell. Character creation arrives in phase 2.
export function App() {
  return (
    <main class="shell">
      <h1>Character Sheet</h1>
      <p>Version {APP_VERSION}</p>
    </main>
  );
}
