// The saved character record: only the player's choices and rolls. Everything else
// on the sheet is recalculated from the rules data, so a rules fix updates old characters.
import type { ClassName, Stat } from "../rules";
import type { StatRoll } from "../engine/abilities";

export const CHARACTER_FORMAT = 1;

export interface CharacterEquipment {
  armour: string | null;
  shield: boolean;
  weapons: string[];
}

export interface Character {
  format: typeof CHARACTER_FORMAT;
  id: string;
  createdAt: string;
  name: string;
  race: string;
  /** The two stats picked for +1 by Human and Half-Elf. */
  raceChoices: Stat[];
  /** Each stat's roll, in the order the stats were picked. */
  rolls: StatRoll[];
  cls: ClassName;
  level: number;
  xp: number;
  /** Fighter Weapon Specialization: which attacks get +2 damage. */
  specialization: "melee" | "ranged" | null;
  /** Experiences the player chose or wrote (class and race fixed ones are added by the rules). */
  experiences: string[];
  equipmentChoices: { choiceOne: string | null; choiceTwo: string | null };
  equipment: CharacterEquipment;
  gold: number;
  cantrips: string[];
  /** Wizard spellbook. */
  knownSpells: string[];
}

export function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `c-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function rolledScores(rolls: StatRoll[]): Record<Stat, number> {
  const out = {} as Record<Stat, number>;
  for (const r of rolls) out[r.stat] = r.total;
  return out;
}

export function toFileText(c: Character): string {
  return JSON.stringify(c, null, 2) + "\n";
}

export function fromFileText(text: string): Character {
  const data = JSON.parse(text) as Partial<Character>;
  if (data.format !== CHARACTER_FORMAT) throw new Error(`Unsupported character file format: ${String(data.format)}`);
  if (!data.name || !data.race || !data.cls || !Array.isArray(data.rolls)) throw new Error("This file is missing character details.");
  return data as Character;
}

export function fileNameFor(c: Character): string {
  const safe = c.name.trim().replace(/[^\p{L}\p{N} _-]+/gu, "").replace(/\s+/g, " ") || "character";
  return `${safe}.character.json`;
}
