// The saved character record: only the player's choices and rolls. Everything else
// on the sheet is recalculated from the rules data, so a rules fix updates old characters.
import type { ClassName, SaveKey, Stat } from "../rules";
import type { StatRoll } from "../engine/abilities";
import { noCoins, type Coins } from "../engine/coins";
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
  /** Inventory, one item per line ("2 x Dagger"). Armour, shields and weapons can be equipped from here. */
  inventory: string[];
  /** Platinum, Gold, Silver and Copper carried. */
  coins: Coins;
  notes: string;
  /** Spell slots spent, per spell level (index 0 = 1st level). */
  /** Spell tracking for each casting class. */
  casting: Partial<Record<ClassName, CastingPlay>>;
}

export interface CastingPlay {
  /** Spell slots spent, per spell level (index 0 = 1st level). */
  slotsSpent: number[];
  prepared: string[];
  spellAttackMisc: number;
}

export const emptyCasting = (): CastingPlay => ({ slotsSpent: [], prepared: [], spellAttackMisc: 0 });

export interface SecretSpell {
  spell: string;
  /** The class spell list it was taken from. */
  from: ClassName;
}

/** One level gained after 1st: what was rolled and what was picked, so it can be undone. */
export interface LevelUp {
  cls: ClassName;
  /** The class level reached. */
  level: number;
  /** The hit die roll (levels 2 to 10), or null when the HP column adds a flat amount (11+). */
  roll: number | null;
  hpGain: number;
  cantrips: string[];
  knownSpells: string[];
  expertise: string[];
  magicalSecrets: SecretSpell[];
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
  /** One class, or two or three for a multiclass character (Classes v4 combinations by race). */
  classes: ClassName[];
  /** Level in each class, in the same order. */
  levels: number[];
  /** The class whose starting equipment options were used. */
  equipmentClass: ClassName;
  xp: number;
  /** Fighter Weapon Specialization: which attacks get +2 damage. */
  specialization: "melee" | "ranged" | null;
  /** Experiences the player chose or wrote (class and race fixed ones are added by the rules). */
  experiences: string[];
  equipmentChoices: { choiceOne: string | null; choiceTwo: string | null };
  equipment: CharacterEquipment;
  gold: number;
  /** Cantrips chosen for each casting class. */
  cantrips: Partial<Record<ClassName, string[]>>;
  /** Wizard spellbook. */
  knownSpells: string[];
  /** Levels gained after 1st, oldest first. */
  levelUps: LevelUp[];
  /** Experiences with Thief Expertise: their bonus is doubled. */
  expertise: string[];
  /** Spells taken with Bard Magical Secrets. */
  magicalSecrets: SecretSpell[];
  /** What the player wrote against an ability, keyed by the ability text (e.g. the Natural Explorer terrain). */
  abilityNotes: Record<string, string>;
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

/** "Dagger" or "2 x Dagger" for each distinct item, in first-seen order. */
function counted(names: string[]): string[] {
  const counts = new Map<string, number>();
  for (const n of names) counts.set(n, (counts.get(n) ?? 0) + 1);
  return [...counts].map(([n, k]) => (k > 1 ? `${k} x ${n}` : n));
}

/**
 * The starting play state for a new character. Each starting weapon gets one row (two Daggers
 * share a row, David); the inventory lists all the starting equipment and gold.
 */
export function initialPlay(c: Pick<Character, "equipment" | "gold">): PlayState {
  const row = (name: string): WeaponRow => ({ name, magic: 0, note: "" });
  const distinct = [...new Set(c.equipment.weapons)];
  const inventory = [...(c.equipment.armour ? [c.equipment.armour] : []), ...(c.equipment.shield ? ["Shield"] : []), ...counted(c.equipment.weapons)];
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
    melee: padRows(distinct.filter((w) => !isRanged(w)).map(row), MELEE_ROWS),
    ranged: padRows(distinct.filter(isRanged).map(row), RANGED_ROWS),
    languages: "",
    inventory,
    coins: { ...noCoins(), gp: c.gold },
    notes: "",
    casting: {},
  };
}

/** Items that were one combined row before the slash names were split (David). */
const RENAMED: Record<string, string> = { "Chain / Banded Mail": "Chain Mail", "Scale Mail / Brigandine": "Scale Mail", "Ranseur/Pike": "Ranseur" };
const rename = (name: string) => RENAMED[name] ?? name;
const renameLine = (line: string) => {
  const { count, name } = parseItem(line);
  return RENAMED[name] ? (count > 1 ? `${count} x ${RENAMED[name]}` : RENAMED[name]!) : line;
};

type OldFields = { cls?: ClassName; level?: number; cantrips?: string[] | Partial<Record<ClassName, string[]>> };
type OldPlay = { slotsSpent?: number[]; prepared?: string[]; spellAttackMisc?: number };

export function fromFileText(text: string): Character {
  const data = JSON.parse(text) as Partial<Character> & OldFields;
  if (data.format !== CHARACTER_FORMAT) throw new Error(`Unsupported character file format: ${String(data.format)}`);
  const classes = data.classes ?? (data.cls ? [data.cls] : null);
  if (!data.name || !data.race || !classes?.length || !Array.isArray(data.rolls) || !data.equipment) throw new Error("This file is missing character details.");
  data.equipment = { ...data.equipment, armour: data.equipment.armour ? rename(data.equipment.armour) : null, weapons: data.equipment.weapons.map(rename) };
  // Files saved before Alignment, play tracking and multiclassing get the defaults.
  const cantrips = Array.isArray(data.cantrips) ? { [classes[0]!]: data.cantrips } : (data.cantrips ?? {});
  const { cls: _cls, level: _level, ...rest } = data;
  const c = {
    alignment: "",
    knownSpells: [],
    levelUps: [],
    expertise: [],
    magicalSecrets: [],
    abilityNotes: {},
    ...rest,
    classes,
    levels: data.levels ?? classes.map(() => data.level ?? 1),
    equipmentClass: data.equipmentClass ?? classes[0]!,
    cantrips,
  } as Character;
  const base = initialPlay(c);
  const old = (data.play ?? {}) as Partial<PlayState> & OldPlay;
  const { slotsSpent, prepared, spellAttackMisc, ...playRest } = old;
  const play = { ...base, ...playRest } as PlayState;
  play.saveNotes = { ...base.saveNotes, ...(old.saveNotes ?? {}) };
  play.melee = padRows(play.melee, MELEE_ROWS);
  play.ranged = padRows(play.ranged, RANGED_ROWS);
  play.casting = { ...(old.casting ?? {}) };
  // Inventory used to be one block of text.
  const inv = old.inventory as unknown;
  if (typeof inv === "string") play.inventory = inv.split("\n").filter((l) => l.trim() !== "");
  play.inventory = play.inventory.map(renameLine);
  // Gold used to be a line in the inventory ("Gold: 7 gp"); it now has its own box.
  if (!old.coins) {
    const goldLine = play.inventory.findIndex((l) => /^\s*Gold:\s*\d+\s*gp\s*$/i.test(l));
    play.coins = { ...noCoins(), gp: goldLine >= 0 ? Number(/\d+/.exec(play.inventory[goldLine]!)![0]) : 0 };
    if (goldLine >= 0) play.inventory = play.inventory.filter((_, i) => i !== goldLine);
  }
  play.armour = play.armour ? rename(play.armour) : null;
  play.melee = play.melee.map((r) => ({ ...r, name: rename(r.name) }));
  play.ranged = play.ranged.map((r) => ({ ...r, name: rename(r.name) }));
  if (slotsSpent || prepared || spellAttackMisc) play.casting[classes[0]!] = { slotsSpent: slotsSpent ?? [], prepared: prepared ?? [], spellAttackMisc: spellAttackMisc ?? 0 };
  return { ...c, play };
}

export function fileNameFor(c: Character): string {
  const safe = c.name.trim().replace(/[^\p{L}\p{N} _-]+/gu, "").replace(/\s+/g, " ") || "character";
  return `${safe}.character.json`;
}

/** "2 x Dagger" -> { count: 2, name: "Dagger" }. */
export function parseItem(line: string): { count: number; name: string } {
  const m = /^\s*(\d+)\s*x\s+(.+?)\s*$/i.exec(line);
  return m ? { count: Number(m[1]), name: m[2]! } : { count: 1, name: line.trim() };
}
