import { defineConfig } from "vitest/config";
import preact from "@preact/preset-vite";

// Settings follow the Tauri guide: fixed dev port, keep Rust errors visible,
// and only expose env vars meant for the frontend.
export default defineConfig({
  plugins: [preact()],
  clearScreen: false,
  server: { port: 1420, strictPort: true },
  envPrefix: ["VITE_", "TAURI_ENV_"],
  build: { target: "es2022" },
  test: { include: ["tests/**/*.test.ts"] },
});
