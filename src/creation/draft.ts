// State of a character being created, and the rules that decide what each step needs.
// Kept free of UI so it can be tested directly.
import {
  STATS,
  cantripsKnown,
  classes,
  experiences as experienceData,
  raceByName,
  spells,
  spellSlots,
  wizardSpellsKnown,
  type ClassName,
  type Stat,
} from "../rules";
import { finalScores, racialModifiers, type StatRoll } from "../engine/abilities";
import { optionsFor, slotsFor, weaponsFor, type Slot } from "../engine/equipment";
import { initialPlay, newId, rolledScores, CHARACTER_FORMAT, type Character, type CharacterEquipment } from "../model/character";

export type StepId = "race" | "stats" | "class" | "experiences" | "equipment" | "spells" | "done";

export interface Draft {
  name: string;
  race: string | null;
  raceChoices: Stat[];
  alignment: string;
  /** Set when the player presses Next on the race step, so they can read the race details first. */
  raceConfirmed: boolean;
  rolls: StatRoll[];
  cls: ClassName | null;
  specialization: "melee" | "ranged" | null;
  experiences: string[];
  choiceOne: string | null;
  choiceTwo: string | null;
  /** Picks for each slot of the chosen options, keyed "one:0", "two:1" and so on. */
  slotPicks: Record<string, string[]>;
  gold: { rolls: number[]; total: number } | null;
  cantrips: string[];
  knownSpells: string[];
}

export const emptyDraft = (): Draft => ({
  name: "",
  race: null,
  raceChoices: [],
  alignment: "",
  raceConfirmed: false,
  rolls: [],
  cls: null,
  specialization: null,
  experiences: [],
  choiceOne: null,
  choiceTwo: null,
  slotPicks: {},
  gold: null,
  cantrips: [],
  knownSpells: [],
});

export function needsRaceChoices(d: Draft): boolean {
  return d.race !== null && raceByName(d.race).chooseTwo === true;
}

export function modifiers(d: Draft): Record<Stat, number> {
  if (!d.race) return Object.fromEntries(STATS.map((s) => [s, 0])) as Record<Stat, number>;
  const race = raceByName(d.race);
  if (race.chooseTwo && d.raceChoices.length !== 2) return racialModifiers({ ...race, chooseTwo: false });
  return racialModifiers(race, d.raceChoices);
}

/** Final scores once all six stats are rolled. Recalculated from the rolls, so a race change applies at once. */
export function scores(d: Draft): Record<Stat, number> | null {
  if (d.rolls.length !== STATS.length) return null;
  return finalScores(rolledScores(d.rolls), modifiers(d));
}

const norm = (s: string) => s.trim().toLowerCase();

/** Experiences the character gets automatically, and how many more the player picks. */
export function experienceSlots(d: Draft): { fixed: string[]; free: number } {
  if (!d.cls || !d.race) return { fixed: [], free: 0 };
  return experienceSlotsFor(d.cls, d.race);
}

export function experienceSlotsFor(clsName: ClassName, raceName: string): { fixed: string[]; free: number } {
  const cls = classes[clsName].experiences;
  const race = raceByName(raceName);
  const fixed = [...cls.fixed, ...race.bonusExperiences];
  const free = (cls.total ?? 0) - cls.fixed.length + (race.bonusExperienceChoices ?? 0);
  return { fixed, free: Math.max(0, free) };
}

/** The starting list, minus anything the character already has. */
export function experienceChoices(d: Draft): string[] {
  const fixed = new Set(experienceSlots(d).fixed.map(norm));
  return experienceData.startingList.filter((e) => !fixed.has(norm(e)));
}

export function isCaster(cls: ClassName | null): boolean {
  if (!cls) return false;
  return cantripsKnown(cls, 1) > 0 || cls === "Wizard";
}

export function cantripCount(d: Draft): number {
  return d.cls ? cantripsKnown(d.cls, 1) : 0;
}

export function knownSpellCount(d: Draft): number {
  const s = scores(d);
  return d.cls === "Wizard" && s ? wizardSpellsKnown(1, s.INT) : 0;
}

/** Spell levels a Wizard can know: any level they have slots for (David). */
export function knowableSpellLevels(cls: ClassName, level: number): number[] {
  return spellSlots(cls, level).map((_, i) => i + 1);
}

export function cantripList(cls: ClassName): string[] {
  return spells[cls]?.levels["0"] ?? [];
}

export function spellList(cls: ClassName, level: number): string[] {
  return spells[cls]?.levels[String(level)] ?? [];
}

/** Slots for a chosen option, with their keys. */
export function slotsWithKeys(which: "one" | "two", option: string | null): { key: string; slot: Slot }[] {
  if (!option) return [];
  return slotsFor(option).map((slot, i) => ({ key: `${which}:${i}`, slot }));
}

function slotComplete(slot: Slot, picks: string[] | undefined): boolean {
  if (slot.kind === "pick") return (picks?.length ?? 0) === slot.count && picks!.every((p) => weaponsFor(slot.filter).some((w) => w.name === p));
  if (slot.kind === "armour") return slot.options.length === 1 || (picks?.length === 1 && slot.options.includes(picks[0]!));
  return true;
}

export function equipmentFor(d: Draft): CharacterEquipment {
  const result: CharacterEquipment = { armour: null, shield: false, weapons: [] };
  for (const { key, slot } of [...slotsWithKeys("one", d.choiceOne), ...slotsWithKeys("two", d.choiceTwo)]) {
    const picks = d.slotPicks[key];
    if (slot.kind === "shield") result.shield = true;
    if (slot.kind === "weapon") for (let i = 0; i < slot.count; i++) result.weapons.push(slot.name);
    if (slot.kind === "pick") result.weapons.push(...(picks ?? []));
    if (slot.kind === "armour") result.armour = slot.options.length === 1 ? slot.options[0]! : (picks?.[0] ?? null);
  }
  return result;
}

export function stepsFor(d: Draft): StepId[] {
  return ["race", "stats", "class", "experiences", "equipment", ...(isCaster(d.cls) ? (["spells"] as StepId[]) : []), "done"];
}

/** Name and race filled in; the Next button is enabled. */
export function raceReady(d: Draft): boolean {
  return d.name.trim() !== "" && d.race !== null && d.alignment !== "" && (!needsRaceChoices(d) || d.raceChoices.length === 2);
}

export function stepComplete(d: Draft, step: StepId): boolean {
  switch (step) {
    case "race":
      return raceReady(d) && d.raceConfirmed;
    case "stats":
      return d.rolls.length === STATS.length;
    case "class":
      return d.cls !== null && (d.cls !== "Fighter" || d.specialization !== null);
    case "experiences":
      return d.cls !== null && d.experiences.length === experienceSlots(d).free;
    case "equipment": {
      if (!d.cls) return false;
      const needsTwo = optionsFor(d.cls).choiceTwo.length > 0;
      if (!d.choiceOne || (needsTwo && !d.choiceTwo) || !d.gold) return false;
      return [...slotsWithKeys("one", d.choiceOne), ...slotsWithKeys("two", d.choiceTwo)].every(({ key, slot }) => slotComplete(slot, d.slotPicks[key]));
    }
    case "spells":
      return d.cantrips.length === cantripCount(d) && d.knownSpells.length === knownSpellCount(d);
    case "done":
      return false;
  }
}

/** The first step that still needs input. */
export function currentStep(d: Draft): StepId {
  return stepsFor(d).find((s) => !stepComplete(d, s)) ?? "done";
}

export function toCharacter(d: Draft): Character {
  if (!d.race || !d.cls || !d.gold) throw new Error("The character is not finished.");
  const equipment = equipmentFor(d);
  const gold = d.gold.total;
  return {
    format: CHARACTER_FORMAT,
    id: newId(),
    createdAt: new Date().toISOString(),
    name: d.name.trim(),
    race: d.race,
    raceChoices: d.raceChoices,
    alignment: d.alignment,
    rolls: d.rolls,
    cls: d.cls,
    level: 1,
    xp: 0,
    specialization: d.specialization,
    experiences: d.experiences,
    equipmentChoices: { choiceOne: d.choiceOne, choiceTwo: d.choiceTwo },
    equipment,
    gold,
    cantrips: d.cantrips,
    knownSpells: d.knownSpells,
    play: initialPlay({ equipment, gold }),
  };
}

/** Changing class clears everything that depends on it. */
export function withClass(d: Draft, cls: ClassName): Draft {
  if (d.cls === cls) return d;
  return { ...d, cls, specialization: null, experiences: [], choiceOne: null, choiceTwo: null, slotPicks: {}, cantrips: [], knownSpells: [] };
}

/** Changing race clears its stat picks and any Experiences that no longer fit the count. */
export function withRace(d: Draft, race: string): Draft {
  if (d.race === race) return d;
  const next = { ...d, race, raceChoices: [] as Stat[] };
  return { ...next, experiences: next.experiences.slice(0, experienceSlots(next).free) };
}
