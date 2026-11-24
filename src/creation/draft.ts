// State of a character being created, and the rules that decide what each step needs.
// Kept free of UI so it can be tested directly.
import {
  STATS,
  abilitiesUpTo,
  cantripsKnown,
  classes as classRules,
  experiences as experienceData,
  raceByName,
  spells,
  spellSlots,
  wizardSpellsKnown,
  type ClassName,
  type Stat,
} from "../rules";
import { finalScores, racialModifiers, type StatRoll } from "../engine/abilities";
import { optionAvailable, optionsFor, slotsFor, weaponsFor, type Slot } from "../engine/equipment";
import { multiclassOptions } from "../engine/multiclass";
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
  /** Whether the player is choosing a multiclass combination. */
  multiclass: boolean;
  /** The chosen class, or the classes of the chosen multiclass combination. Empty until chosen. */
  classes: ClassName[];
  specialization: "melee" | "ranged" | null;
  experiences: string[];
  /** Thief Expertise: Experiences picked to double. */
  expertise: string[];
  /** Which class's starting equipment options are used (multiclass characters pick one). */
  equipmentClass: ClassName | null;
  choiceOne: string | null;
  choiceTwo: string | null;
  /** Picks for each slot of the chosen options, keyed "one:0", "two:1" and so on. */
  slotPicks: Record<string, string[]>;
  gold: { rolls: number[]; total: number } | null;
  /** Cantrips for each casting class. */
  cantrips: Partial<Record<ClassName, string[]>>;
  knownSpells: string[];
}

export const emptyDraft = (): Draft => ({
  name: "",
  race: null,
  raceChoices: [],
  alignment: "",
  raceConfirmed: false,
  rolls: [],
  multiclass: false,
  classes: [],
  specialization: null,
  experiences: [],
  expertise: [],
  equipmentClass: null,
  choiceOne: null,
  choiceTwo: null,
  slotPicks: {},
  gold: null,
  cantrips: {},
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
  if (d.classes.length === 0 || !d.race) return { fixed: [], free: 0 };
  return experienceSlotsFor(d.classes, d.race);
}

/**
 * Fixed Experiences from every class and the race, plus free picks. A multiclass character
 * gets the highest free count among their classes (David).
 */
export function experienceSlotsFor(classNames: ClassName[], raceName: string): { fixed: string[]; free: number } {
  const race = raceByName(raceName);
  const fixed: string[] = [];
  for (const e of [...classNames.flatMap((c) => classRules[c].experiences.fixed), ...race.bonusExperiences]) {
    if (!fixed.some((f) => norm(f) === norm(e))) fixed.push(e);
  }
  const classFree = Math.max(...classNames.map((c) => (classRules[c].experiences.total ?? 0) - classRules[c].experiences.fixed.length));
  return { fixed, free: Math.max(0, classFree + (race.bonusExperienceChoices ?? 0)) };
}

/** The starting list, minus anything the character already has. */
export function experienceChoices(d: Draft): string[] {
  const fixed = new Set(experienceSlots(d).fixed.map(norm));
  return experienceData.startingList.filter((e) => !fixed.has(norm(e)));
}

/** Thief Expertise picks at 1st level: two for each "Expertise" ability (Classes v4). */
export function expertiseCount(d: Draft): number {
  return 2 * d.classes.flatMap((c) => abilitiesUpTo(c, 1)).filter((a) => a.text.startsWith("Expertise")).length;
}

/** Experiences that can take Expertise: the fixed ones and the ones picked. */
export function expertiseChoices(d: Draft): string[] {
  return [...experienceSlots(d).fixed, ...d.experiences];
}

export function isCasterClass(cls: ClassName): boolean {
  return cantripsKnown(cls, 1) > 0 || cls === "Wizard";
}

/** Classes that choose spells during creation: those with cantrips, and Wizards. */
export function creationCasters(d: Draft): ClassName[] {
  return d.classes.filter(isCasterClass);
}

export function cantripCount(cls: ClassName): number {
  return cantripsKnown(cls, 1);
}

export function knownSpellCount(d: Draft): number {
  const s = scores(d);
  return d.classes.includes("Wizard") && s ? wizardSpellsKnown(1, s.INT) : 0;
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

/** A chosen option the character may not take (armour too heavy or not allowed for their classes). */
function optionBlocked(d: Draft, option: string | null): boolean {
  const s = scores(d);
  return option !== null && s !== null && !optionAvailable(option, s.STR, d.classes);
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
  return ["race", "stats", "class", "experiences", "equipment", ...(creationCasters(d).length > 0 ? (["spells"] as StepId[]) : []), "done"];
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
      return d.classes.length > 0 && (!d.classes.includes("Fighter") || d.specialization !== null);
    case "experiences":
      return d.classes.length > 0 && d.experiences.length === experienceSlots(d).free && d.expertise.length === expertiseCount(d) && d.expertise.every((e) => expertiseChoices(d).includes(e));
    case "equipment": {
      if (!d.equipmentClass) return false;
      const needsTwo = optionsFor(d.equipmentClass).choiceTwo.length > 0;
      if (!d.choiceOne || (needsTwo && !d.choiceTwo) || !d.gold) return false;
      if (optionBlocked(d, d.choiceOne) || optionBlocked(d, d.choiceTwo)) return false;
      return [...slotsWithKeys("one", d.choiceOne), ...slotsWithKeys("two", d.choiceTwo)].every(({ key, slot }) => slotComplete(slot, d.slotPicks[key]));
    }
    case "spells":
      return creationCasters(d).every((c) => (d.cantrips[c]?.length ?? 0) === cantripCount(c)) && d.knownSpells.length === knownSpellCount(d);
    case "done":
      return false;
  }
}

/** The first step that still needs input. */
export function currentStep(d: Draft): StepId {
  return stepsFor(d).find((s) => !stepComplete(d, s)) ?? "done";
}

export function toCharacter(d: Draft): Character {
  if (!d.race || d.classes.length === 0 || !d.gold || !d.equipmentClass) throw new Error("The character is not finished.");
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
    classes: d.classes,
    levels: d.classes.map(() => 1),
    equipmentClass: d.equipmentClass,
    xp: 0,
    specialization: d.classes.includes("Fighter") ? d.specialization : null,
    experiences: d.experiences,
    equipmentChoices: { choiceOne: d.choiceOne, choiceTwo: d.choiceTwo },
    equipment,
    gold,
    cantrips: Object.fromEntries(creationCasters(d).map((c) => [c, d.cantrips[c] ?? []])),
    knownSpells: d.classes.includes("Wizard") ? d.knownSpells : [],
    levelUps: [],
    expertise: d.expertise,
    magicalSecrets: [],
    abilityNotes: {},
    play: initialPlay({ equipment, gold }),
  };
}

/** Changing class clears everything that depends on it. A single class also sets the equipment class. */
export function withClasses(d: Draft, classes: ClassName[]): Draft {
  if (d.classes.join("/") === classes.join("/")) return d;
  return {
    ...d,
    classes,
    specialization: null,
    experiences: [],
    expertise: [],
    equipmentClass: classes.length === 1 ? classes[0]! : null,
    choiceOne: null,
    choiceTwo: null,
    slotPicks: {},
    cantrips: {},
    knownSpells: [],
  };
}

export const withClass = (d: Draft, cls: ClassName): Draft => withClasses({ ...d, multiclass: false }, [cls]);

/** Switching between single class and multiclass clears the class choice. */
export function withMulticlass(d: Draft, multiclass: boolean): Draft {
  if (d.multiclass === multiclass) return d;
  return { ...withClasses(d, []), multiclass };
}

/** Picking which class's starting equipment to use clears the equipment choices. */
export function withEquipmentClass(d: Draft, cls: ClassName): Draft {
  if (d.equipmentClass === cls) return d;
  return { ...d, equipmentClass: cls, choiceOne: null, choiceTwo: null, slotPicks: {} };
}

/**
 * Changing race clears its stat picks and any Experiences that no longer fit the count.
 * A multiclass combination the new race cannot take is cleared too.
 */
export function withRace(d: Draft, race: string): Draft {
  if (d.race === race) return d;
  let next: Draft = { ...d, race, raceChoices: [] };
  if (next.multiclass && !multiclassOptions(race).some((o) => o.join("/") === next.classes.join("/"))) next = withClasses(next, []);
  return { ...next, experiences: next.experiences.slice(0, experienceSlots(next).free) };
}
