// Gaining XP and levels (Classes v4, with David's decisions in decisions.json):
// - XP added is raised by the race's XP bonus (Human +20%); a multiclass character's XP is split equally.
// - Levels 2 to 10 roll the class hit die and add that class's CON bonus; from 11th the HP column
//   adds a flat amount with no CON. A multiclass character divides either by the number of classes.
// - New cantrips, a Wizard's new spell, Thief Expertise and Bard Magical Secrets are picked when levelling.
import { CLASS_NAMES, abilitiesUpTo, cantripsKnown, classes, raceByName, spellSlots, spells, type ClassName } from "../rules";
import { hpForClassLevel, type StatBonuses } from "./derive";
import type { Character, LevelUp, SecretSpell } from "../model/character";

export const MAX_LEVEL = 20;

/** XP actually gained for XP earned: the race's XP bonus is added, rounded down. */
export function xpWithBonus(race: string, earned: number): number {
  const bonus = raceByName(race).xpBonusPercent ?? 0;
  return Math.floor((earned * (100 + bonus)) / 100);
}

export function addXp(c: Character, earned: number): Character {
  return { ...c, xp: Math.max(0, c.xp + xpWithBonus(c.race, earned)) };
}

/** Each class's share of the XP (divided equally between the classes, rounded down). */
export function classXp(c: Character): number {
  return Math.floor(c.xp / c.classes.length);
}

/** XP Required for the next level of a class, or null at 20th. */
export function nextLevelXp(cls: ClassName, level: number): number | null {
  return level >= MAX_LEVEL ? null : (classes[cls].xp[level] ?? null);
}

/** Indexes of the classes with enough XP to gain a level. */
export function readyToLevel(c: Character): number[] {
  const xp = classXp(c);
  return c.classes.flatMap((cls, i) => {
    const need = nextLevelXp(cls, c.levels[i] ?? 1);
    return need !== null && xp >= need ? [i] : [];
  });
}

export type HpStep = { kind: "roll"; die: number } | { kind: "flat"; amount: number };

const HP_DICE = /^(\d+)d(\d+)(?:\+(\d+))?$/;

/** What the HP column adds going from one level to the next: another hit die, or a flat amount. */
export function hpStep(cls: ClassName, newLevel: number): HpStep {
  const prev = HP_DICE.exec(classes[cls].hp[newLevel - 2] ?? "");
  const next = HP_DICE.exec(classes[cls].hp[newLevel - 1] ?? "");
  if (!prev || !next) throw new Error(`Cannot read the ${cls} HP column at level ${newLevel}`);
  if (Number(next[1]) > Number(prev[1])) return { kind: "roll", die: Number(next[2]) };
  return { kind: "flat", amount: Number(next[3] ?? 0) - Number(prev[3] ?? 0) };
}

/** HP gained for a level: a roll plus that class's CON (levels 2 to 10), or the flat amount (11+), shared between classes. */
export function hpGain(cls: ClassName, step: HpStep, roll: number | null, classCount: number, bonuses: StatBonuses): number {
  if (step.kind === "flat") return Math.max(1, Math.floor(step.amount / classCount));
  if (roll === null || roll < 1 || roll > step.die) throw new Error(`A d${step.die} roll must be 1 to ${step.die}`);
  return hpForClassLevel(cls, roll, classCount, bonuses);
}

/** Maximum HP: 1st level plus every level gained since. */
export function totalHp(level1: number, c: Character): number {
  return level1 + c.levelUps.reduce((t, l) => t + l.hpGain, 0);
}

export interface LevelChoices {
  cls: ClassName;
  newLevel: number;
  hp: HpStep;
  /** Abilities gained at exactly the new level. */
  newAbilities: string[];
  cantrips: number;
  knownSpells: number;
  expertise: number;
  magicalSecrets: number;
}

/** What gaining the next level in a class gives and asks the player to pick. */
export function choicesFor(c: Character, index: number): LevelChoices {
  const cls = c.classes[index]!;
  const newLevel = (c.levels[index] ?? 1) + 1;
  const newAbilities = abilitiesUpTo(cls, newLevel)
    .filter((a) => a.level === newLevel)
    .map((a) => a.text);
  return {
    cls,
    newLevel,
    hp: hpStep(cls, newLevel),
    newAbilities,
    cantrips: Math.max(0, cantripsKnown(cls, newLevel) - cantripsKnown(cls, newLevel - 1)),
    knownSpells: cls === "Wizard" ? 1 : 0,
    expertise: 2 * newAbilities.filter((t) => t.startsWith("Expertise")).length,
    magicalSecrets: newAbilities.filter((t) => t.startsWith("Magical Secrets")).length,
  };
}

/** Spell levels a class can cast at a level: those it has slots for. */
const castableLevels = (cls: ClassName, level: number) => spellSlots(cls, level).map((_, i) => i + 1);

export function cantripOptions(c: Character, cls: ClassName): string[] {
  const known = c.cantrips[cls] ?? [];
  return (spells[cls]?.levels["0"] ?? []).filter((s) => !known.includes(s));
}

/** Wizard spells of any level castable at the new level, not yet in the spellbook. */
export function wizardSpellOptions(c: Character, newLevel: number): string[] {
  return castableLevels("Wizard", newLevel).flatMap((l) => (spells.Wizard?.levels[String(l)] ?? []).filter((s) => !c.knownSpells.includes(s)));
}

/**
 * Magical Secrets: a spell from any other class's list, of a spell level the Bard can cast at the
 * new level (the level limit is an interpretation, flagged in the rules report).
 */
export function secretOptions(c: Character, newLevel: number): SecretSpell[] {
  const levels = castableLevels("Bard", newLevel);
  const taken = new Set(c.magicalSecrets.map((s) => s.spell));
  const out: SecretSpell[] = [];
  for (const from of CLASS_NAMES) {
    if (from === "Bard") continue;
    for (const l of levels) for (const spell of spells[from]?.levels[String(l)] ?? []) if (!taken.has(spell) && !out.some((o) => o.spell === spell)) out.push({ spell, from });
  }
  return out.sort((a, b) => a.spell.localeCompare(b.spell));
}

/** Experiences that can take Expertise: all the character's Experiences not already doubled. */
export function expertiseOptions(allExperiences: string[], c: Character): string[] {
  return allExperiences.filter((e) => e.trim() !== "" && !c.expertise.includes(e));
}

export type LevelUpPicks = Pick<LevelUp, "roll" | "hpGain" | "cantrips" | "knownSpells" | "expertise" | "magicalSecrets">;

/** Gains the next level in one class, recording the roll and picks so it can be undone. */
export function applyLevelUp(c: Character, index: number, picks: LevelUpPicks): Character {
  const cls = c.classes[index]!;
  const level = (c.levels[index] ?? 1) + 1;
  const levels = c.levels.map((l, i) => (i === index ? level : l));
  return {
    ...c,
    levels,
    levelUps: [...c.levelUps, { cls, level, ...picks }],
    cantrips: picks.cantrips.length ? { ...c.cantrips, [cls]: [...(c.cantrips[cls] ?? []), ...picks.cantrips] } : c.cantrips,
    knownSpells: [...c.knownSpells, ...picks.knownSpells],
    expertise: [...c.expertise, ...picks.expertise],
    magicalSecrets: [...c.magicalSecrets, ...picks.magicalSecrets],
    play: { ...c.play, hpCurrent: c.play.hpCurrent === null ? null : c.play.hpCurrent + picks.hpGain },
  };
}

/** Takes back the most recent level gained, and everything picked with it. */
export function undoLevelUp(c: Character): Character {
  const last = c.levelUps[c.levelUps.length - 1];
  if (!last) return c;
  const index = c.classes.indexOf(last.cls);
  const without = <T>(list: T[], remove: T[]) => list.filter((x) => !remove.includes(x));
  return {
    ...c,
    levels: c.levels.map((l, i) => (i === index ? l - 1 : l)),
    levelUps: c.levelUps.slice(0, -1),
    cantrips: { ...c.cantrips, [last.cls]: without(c.cantrips[last.cls] ?? [], last.cantrips) },
    knownSpells: without(c.knownSpells, last.knownSpells),
    expertise: without(c.expertise, last.expertise),
    magicalSecrets: c.magicalSecrets.filter((s) => !last.magicalSecrets.some((x) => x.spell === s.spell)),
    play: { ...c.play, hpCurrent: c.play.hpCurrent === null ? null : c.play.hpCurrent - last.hpGain },
  };
}
