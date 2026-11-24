// Saving and opening character files. In the desktop app this uses the native file
// dialogs; in a plain browser (npm run dev) it falls back to a download and a file picker.
import { fileNameFor, fromFileText, toFileText, type Character } from "./model/character";

const inTauri = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/** Returns where the file went, or null if the player cancelled. */
export async function saveCharacterFile(c: Character): Promise<string | null> {
  const text = toFileText(c);
  if (inTauri()) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const { writeTextFile } = await import("@tauri-apps/plugin-fs");
    const path = await save({ defaultPath: fileNameFor(c), filters: [{ name: "Character", extensions: ["json"] }] });
    if (!path) return null;
    await writeTextFile(path, text);
    return path;
  }
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileNameFor(c);
  a.click();
  URL.revokeObjectURL(url);
  return a.download;
}

export async function openCharacterFile(): Promise<Character | null> {
  if (inTauri()) {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const { readTextFile } = await import("@tauri-apps/plugin-fs");
    const path = await open({ multiple: false, filters: [{ name: "Character", extensions: ["json"] }] });
    if (typeof path !== "string") return null;
    return fromFileText(await readTextFile(path));
  }
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      try {
        resolve(fromFileText(await file.text()));
      } catch (e) {
        reject(e);
      }
    };
    input.click();
  });
}
