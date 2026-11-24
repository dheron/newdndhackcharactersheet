// Exporting and importing files anywhere the player chooses. The library of characters the app
// keeps is in src/library.ts. In the desktop app these use the system file dialogs. In the web
// version, saving opens the share sheet where the device has one (on iPad: Save to Files, which
// includes iCloud Drive, or AirDrop) and otherwise downloads the file; opening uses a file picker.
import { fileNameFor, toFileText, type Character } from "./model/character";

export const inTauri = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/** Where an exported file went: a path (desktop), or a label (web). */
export type FilePath = string | null;

/** Saves text to a file the player chooses. Returns where it went, or undefined if they cancelled. */
export async function saveTextAs(fileName: string, text: string): Promise<{ path: FilePath; label: string } | undefined> {
  if (inTauri()) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const { writeTextFile } = await import("@tauri-apps/plugin-fs");
    const path = await save({ defaultPath: fileName, filters: [{ name: "Character", extensions: ["json"] }] });
    if (!path) return undefined;
    await writeTextFile(path, text);
    return { path, label: path };
  }
  const file = new File([text], fileName, { type: "application/json" });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: fileName });
      return { path: null, label: "the place you chose" };
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return undefined;
      // Sharing not allowed here: fall back to a download.
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
  return { path: null, label: `Downloads (${fileName})` };
}

export function saveCharacterFileAs(c: Character) {
  return saveTextAs(fileNameFor(c), toFileText(c));
}

/** Asks for a file and returns its text, or null if the player cancelled. */
export async function openTextFile(): Promise<string | null> {
  if (inTauri()) {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const { readTextFile } = await import("@tauri-apps/plugin-fs");
    const path = await open({ multiple: false, filters: [{ name: "Character", extensions: ["json"] }] });
    if (typeof path !== "string") return null;
    return readTextFile(path);
  }
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.onchange = async () => {
      const file = input.files?.[0];
      resolve(file ? await file.text() : null);
    };
    input.click();
  });
}
