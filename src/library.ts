// The character library. In the desktop app every character is a file in the "Character Sheets"
// folder in Documents, saved as the player plays (David). In a plain browser (npm run dev) the
// characters live in the browser's own storage instead, for development only.
import { fileNameFor, fromFileText, newId, toFileText, type Character } from "./model/character";
import { classAndLevel } from "./sheet/derived";
import { inTauri, openCharacterFile } from "./storage";

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
    return Object.keys(localStorage)
      .filter((k) => k.startsWith(BROWSER_PREFIX))
      .map((k) => ({ key: k, text: localStorage.getItem(k) ?? "" }));
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

export async function saveCharacter(c: Character): Promise<void> {
  if (!inTauri()) {
    localStorage.setItem(BROWSER_PREFIX + c.id, toFileText(c));
    return;
  }
  const { mod, opts } = await fs();
  await mod.writeTextFile(`${LIBRARY_FOLDER}/${libraryFileName(c)}`, toFileText(c), opts);
}

export async function deleteCharacter(id: string): Promise<void> {
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

/** Brings a character file from anywhere into the library. A character already there is added as a copy. */
export async function importCharacter(): Promise<Character | null> {
  const opened = await openCharacterFile();
  if (!opened) return null;
  const c = (await keyFor(opened.character.id)) ? copyOf(opened.character, opened.character.name) : opened.character;
  await saveCharacter(c);
  return c;
}
