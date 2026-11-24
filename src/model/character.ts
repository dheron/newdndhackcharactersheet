// The saved character record: only the player's choices and rolls. Everything else
// on the sheet is recalculated from the rules data, so a rules fix updates old characters.
import type { ClassName, SaveKey, Stat } from "../rules";
import type { StatRoll } from "../engine/abilities";
import { isRangedWeapon, weaponByName } from "../engine/equipment";

const isRanged = (name: string) => isRangedWeapon(weaponByName(name));

export const CHARACTER_FORMAT = 1;

export interface CharacterEquipment {
  armour: string | null;
  shield: boolean;
  weapons: string[];
}

export interface WeaponRow {
  name: string;
  magic: number;
  note: string;
}

export const MELEE_ROWS = 4;
export const RANGED_ROWS = 3;
export const EXPERIENCE_LINES = 13;

/** What changes while playing. Kept apart from the creation record. */
export interface PlayState {
  hpCurrent: number | null;
  tempHp: number | null;
  /** Hit dice lines 2 and 3 (line 1 comes from the class table). */
  hitDiceLines: [string, string];
  /** Experience lines after the ones from creation. */
  extraExperiences: string[];
  saveNotes: Record<SaveKey, string>;
  spareSaveNotes: [string, string];
  armour: string | null;
  shield: boolean;
  acMisc: number;
  acNote: string;
  melee: WeaponRow[];
  ranged: WeaponRow[];
  languages: string;
  inventory: string;
  /** Spell slots spent, per spell level (index 0 = 1st level). */
  slotsSpent: number[];
  prepared: string[];
  spellAttackMisc: number;
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
  /** One of the basic 5e alignments (decisions.json). */
  alignment: string;
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
  play: PlayState;
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

const emptyRow = (): WeaponRow => ({ name: "", magic: 0, note: "" });

function padRows(rows: WeaponRow[], n: number): WeaponRow[] {
  return Array.from({ length: n }, (_, i) => ({ ...emptyRow(), ...rows[i] }));
}

/** The starting play state for a new character: starting weapons sorted into the melee and ranged rows. */
export function initialPlay(c: Pick<Character, "equipment" | "gold">): PlayState {
  const row = (name: string): WeaponRow => ({ name, magic: 0, note: "" });
  return {
    hpCurrent: null,
    tempHp: null,
    hitDiceLines: ["", ""],
    extraExperiences: [],
    saveNotes: { deathParalyze: "", magicItem: "", petrificationPolymorph: "", blastBarrage: "", spell: "" },
    spareSaveNotes: ["", ""],
    armour: c.equipment.armour,
    shield: c.equipment.shield,
    acMisc: 0,
    acNote: "",
    melee: padRows(c.equipment.weapons.filter((w) => !isRanged(w)).map(row), MELEE_ROWS),
    ranged: padRows(c.equipment.weapons.filter(isRanged).map(row), RANGED_ROWS),
    languages: "",
    inventory: `Gold: ${c.gold} gp`,
    slotsSpent: [],
    prepared: [],
    spellAttackMisc: 0,
  };
}

export function fromFileText(text: string): Character {
  const data = JSON.parse(text) as Partial<Character>;
  if (data.format !== CHARACTER_FORMAT) throw new Error(`Unsupported character file format: ${String(data.format)}`);
  if (!data.name || !data.race || !data.cls || !Array.isArray(data.rolls) || !data.equipment) throw new Error("This file is missing character details.");
  // Files saved before Alignment and play tracking existed get the defaults.
  const c = { alignment: "", cantrips: [], knownSpells: [], ...data } as Character;
  const base = initialPlay(c);
  const play = { ...base, ...(data.play ?? {}) } as PlayState;
  play.saveNotes = { ...base.saveNotes, ...(data.play?.saveNotes ?? {}) };
  play.melee = padRows(play.melee, MELEE_ROWS);
  play.ranged = padRows(play.ranged, RANGED_ROWS);
  return { ...c, play };
}

export function fileNameFor(c: Character): string {
  const safe = c.name.trim().replace(/[^\p{L}\p{N} _-]+/gu, "").replace(/\s+/g, " ") || "character";
  return `${safe}.character.json`;
}
