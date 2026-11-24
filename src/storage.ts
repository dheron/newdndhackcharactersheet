// Exporting and importing character files anywhere the player chooses. The library of
// characters the app keeps is in src/library.ts. In a plain browser (npm run dev) export is a
// download and import is a file picker.
import { fileNameFor, fromFileText, toFileText, type Character } from "./model/character";

export const inTauri = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/** Where a character's file lives. Null in the browser, where files can only be downloaded. */
export type FilePath = string | null;

/** Asks where to export. Returns the path (desktop), the download name (browser), or undefined if cancelled. */
export async function saveCharacterFileAs(c: Character): Promise<{ path: FilePath; label: string } | undefined> {
  const text = toFileText(c);
  if (inTauri()) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const { writeTextFile } = await import("@tauri-apps/plugin-fs");
    const path = await save({ defaultPath: fileNameFor(c), filters: [{ name: "Character", extensions: ["json"] }] });
    if (!path) return undefined;
    await writeTextFile(path, text);
    return { path, label: path };
  }
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileNameFor(c);
  a.click();
  URL.revokeObjectURL(url);
  return { path: null, label: a.download };
}

export async function openCharacterFile(): Promise<{ character: Character; path: FilePath } | null> {
  if (inTauri()) {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const { readTextFile } = await import("@tauri-apps/plugin-fs");
    const path = await open({ multiple: false, filters: [{ name: "Character", extensions: ["json"] }] });
    if (typeof path !== "string") return null;
    return { character: fromFileText(await readTextFile(path)), path };
  }
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      try {
        resolve({ character: fromFileText(await file.text()), path: null });
      } catch (e) {
        reject(e);
      }
    };
    input.click();
  });
}
