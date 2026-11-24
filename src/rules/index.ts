// Typed access to the rules data in ./data. Values come from David's Drive docs;
// each data file names its source. Formulas that combine values (HP, AC, attacks)
// live in the engine and are added in phase 2.
import abilityData from "./data/ability-scores.json";
import classData from "./data/classes.json";
import raceData from "./data/races.json";
import saveData from "./data/saving-throws.json";
import experienceData from "./data/experiences.json";
import equipmentData from "./data/equipment.json";
import spellData from "./data/spells.json";
import turnUndeadData from "./data/turn-undead.json";
import multiclassData from "./data/multiclass.json";
import decisionData from "./data/decisions.json";

export const STATS = ["STR", "DEX", "CON", "INT", "WIS", "CHA"] as const;
export type Stat = (typeof STATS)[number];

export const CLASS_NAMES = ["Fighter", "Barbarian", "Paladin", "Ranger", "Cleric", "Druid", "Bard", "Thief", "Wizard"] as const;
export type ClassName = (typeof CLASS_NAMES)[number];

export const SAVE_KEYS = ["deathParalyze", "magicItem", "petrificationPolymorph", "blastBarrage", "spell"] as const;
export type SaveKey = (typeof SAVE_KEYS)[number];

export const MIN_LEVEL = 1;
export const MAX_LEVEL = 20;

export interface ClassRules {
  armour: string | null;
  weapons: string | null;
  experiences: { docText: string | null; fixed: string[]; total: number | null };
  knownSpells?: { docText: string };
  xp: number[];
  attackBonus: number[];
  spellAttack?: number[];
  hp: string[];
  spellSlots?: number[][];
  cantrips?: Record<string, number>;
  abilities: Record<string, string[]>;
}

export interface RaceRules {
  name: string;
  modifiers: Partial<Record<Stat, number>>;
  chooseTwo?: boolean;
  traits: string[];
  saveBonus: Partial<Record<SaveKey, number>>;
  situational: { save: SaveKey | null; text: string }[];
  bonusExperiences: string[];
  bonusExperienceChoices?: number;
  xpBonusPercent?: number;
}

export interface Weapon {
  name: string;
  category: "Simple" | "Martial";
  cost: number | null;
  type: string | null;
  damage: string | null;
  range: string | null;
  traits: string[];
  typeSource?: string;
}

export interface Armour {
  name: string;
  group: "Shield" | "Light" | "Medium" | "Heavy";
  cost: number | null;
  acText: string;
  baseAC: number | null;
  acBonus: number | null;
  dexCap: number | null;
  strReq: number | null;
  notes: string | null;
}

export const SOURCES = {
  abilityScores: abilityData.source,
  classes: classData.source,
  races: raceData.source,
  savingThrows: saveData.source,
  experiences: experienceData.source,
  equipment: equipmentData.source,
  turnUndead: turnUndeadData.source,
  multiclass: multiclassData.source,
  decisions: decisionData.source,
};

/** Rules David decided in chat that are not yet in the Drive docs. */
export const decisions = decisionData as typeof decisionData & {
  spellcasting: Partial<Record<ClassName, { spellAttackBase: string; spellAttackStat: Stat | null; potency: "arcane" | "divine" }>>;
};

export const classes = classData.classes as Record<ClassName, ClassRules>;
export const races = raceData.races as RaceRules[];
export const weapons = equipmentData.weapons as Weapon[];
export const armour = equipmentData.armour as Armour[];
export const startingOptions = equipmentData.startingOptions.classes as Record<ClassName, { choiceOne: string[]; choiceTwo: string[] }>;
export const experiences = experienceData;
export const spells = spellData.classes as Partial<Record<ClassName, { source: string; levels: Record<string, string[]> }>>;
export const turnUndead = turnUndeadData;
export const multiclass = multiclassData;

const abilityTables = abilityData as unknown as Record<Stat, Record<string, number[]>> & { minScore: number; maxScore: number };

function checkLevel(level: number): number {
  if (!Number.isInteger(level) || level < MIN_LEVEL || level > MAX_LEVEL) {
    throw new RangeError(`Level must be a whole number from ${MIN_LEVEL} to ${MAX_LEVEL}, got ${level}`);
  }
  return level - 1;
}

/** Look up one column of the Ability Score Tables. Scores outside 3 to 24 are an error. */
export function abilityValue(stat: Stat, column: string, score: number): number {
  const table = abilityTables[stat]?.[column];
  if (!Array.isArray(table)) throw new Error(`No ${column} column for ${stat}`);
  if (!Number.isInteger(score) || score < abilityTables.minScore || score > abilityTables.maxScore) {
    throw new RangeError(`Score must be a whole number from ${abilityTables.minScore} to ${abilityTables.maxScore}, got ${score}`);
  }
  const value = table[score - abilityTables.minScore];
  if (value === undefined) throw new Error(`Missing ${stat} ${column} value for score ${score}`);
  return value;
}

export function isWarrior(cls: ClassName): boolean {
  return (abilityData.CON.warriorClasses as string[]).includes(cls);
}

export function saveTargets(cls: ClassName, level: number): Record<SaveKey, number> {
  const row = (saveData.classes as Record<ClassName, number[][]>)[cls][checkLevel(level)];
  if (!row) throw new Error(`No saves for ${cls} level ${level}`);
  return Object.fromEntries(SAVE_KEYS.map((key, i) => [key, row[i]])) as Record<SaveKey, number>;
}

export function attackBonus(cls: ClassName, level: number): number {
  return classes[cls].attackBonus[checkLevel(level)]!;
}

export function spellSlots(cls: ClassName, level: number): number[] {
  return classes[cls].spellSlots?.[checkLevel(level)] ?? [];
}

/** Cantrips known at a level: the last entry at or below that level, or 0. */
export function cantripsKnown(cls: ClassName, level: number): number {
  checkLevel(level);
  let count = 0;
  for (const [from, n] of Object.entries(classes[cls].cantrips ?? {})) {
    if (Number(from) <= level) count = Math.max(count, n);
  }
  return count;
}

/** Class abilities gained at or below a level, in level order. */
export function abilitiesUpTo(cls: ClassName, level: number): { level: number; text: string }[] {
  checkLevel(level);
  return Object.entries(classes[cls].abilities)
    .map(([lvl, list]) => ({ lvl: Number(lvl), list }))
    .filter(({ lvl }) => lvl <= level)
    .sort((a, b) => a.lvl - b.lvl)
    .flatMap(({ lvl, list }) => list.map((text) => ({ level: lvl, text })));
}

/**
 * Wizard spells known (Classes v4): "1st level = known languages, +1 spell on each level up".
 * Known languages is the INT Languages column of Ability Score Tables v4.
 */
export function wizardSpellsKnown(level: number, intScore: number): number {
  checkLevel(level);
  return abilityValue("INT", "languages", intScore) + (level - 1);
}

/** Hit die size from the level 1 HP column ("1d10" gives 10). */
export function hitDie(cls: ClassName): number {
  const match = /^1d(\d+)$/.exec(classes[cls].hp[0] ?? "");
  if (!match) throw new Error(`Unexpected level 1 HP for ${cls}: ${classes[cls].hp[0]}`);
  return Number(match[1]);
}

export function raceByName(name: string): RaceRules {
  const race = races.find((r) => r.name === name);
  if (!race) throw new Error(`Unknown race ${name}`);
  return race;
}
