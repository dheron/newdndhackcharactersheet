import { describe, expect, it } from "vitest";
import { STATS, classes, experiences, raceByName, type Stat } from "../src/rules";
import type { StatRoll } from "../src/engine/abilities";
import { deriveSheet } from "../src/engine/derive";
import {
  currentStep,
  emptyDraft,
  equipmentFor,
  experienceChoices,
  experienceSlots,
  knownSpellCount,
  scores,
  stepComplete,
  stepsFor,
  toCharacter,
  withClass,
  withRace,
  type Draft,
} from "../src/creation/draft";
import { fromFileText, toFileText } from "../src/model/character";

const rolls = (values: number[]): StatRoll[] =>
  STATS.map((stat, pick) => ({ stat, pick, method: "test", dice: [values[pick]!], kept: [values[pick]!], total: values[pick]! }) as StatRoll);

const base = (patch: Partial<Draft> = {}): Draft => ({ ...emptyDraft(), name: "Test", race: "Dwarf (Mountain)", rolls: rolls([16, 12, 15, 10, 13, 8]), ...patch });

describe("creation steps", () => {
  it("starts at name and race and moves on as steps complete", () => {
    expect(currentStep(emptyDraft())).toBe("race");
    expect(currentStep({ ...emptyDraft(), name: "A", race: "Dwarf (Mountain)" })).toBe("stats");
    expect(currentStep(base())).toBe("class");
  });

  it("needs two stat picks for Human", () => {
    const d = { ...base(), race: "Human" };
    expect(raceByName("Human").chooseTwo).toBe(true);
    expect(stepComplete(d, "race")).toBe(false);
    expect(stepComplete({ ...d, raceChoices: ["STR", "CON"] as Stat[] }, "race")).toBe(true);
  });

  it("applies a race change to scores at once", () => {
    const dwarf = scores(base())!;
    const elf = scores(withRace(base(), "Elf (High)"))!;
    const raw = 16;
    expect(dwarf.STR - raw).toBe(raceByName("Dwarf (Mountain)").modifiers.STR ?? 0);
    expect(elf.STR - raw).toBe(raceByName("Elf (High)").modifiers.STR ?? 0);
  });

  it("only casters get a spells step", () => {
    expect(stepsFor(withClass(base(), "Fighter"))).not.toContain("spells");
    expect(stepsFor(withClass(base(), "Wizard"))).toContain("spells");
    expect(stepsFor(withClass(base(), "Cleric"))).toContain("spells");
  });

  it("needs a Fighter specialization", () => {
    const d = withClass(base(), "Fighter");
    expect(stepComplete(d, "class")).toBe(false);
    expect(stepComplete({ ...d, specialization: "melee" }, "class")).toBe(true);
  });

  it("changing class clears what depended on it", () => {
    const d = { ...withClass(base(), "Fighter"), specialization: "melee" as const, experiences: ["x"], choiceOne: "Two-Handed Martial Melee" };
    const w = withClass(d, "Wizard");
    expect(w.specialization).toBeNull();
    expect(w.experiences).toEqual([]);
    expect(w.choiceOne).toBeNull();
  });
});

describe("experiences", () => {
  it("counts class fixed and free picks, plus race bonuses", () => {
    for (const cls of ["Fighter", "Wizard", "Paladin", "Thief"] as const) {
      const d = withClass(base({ race: "Dwarf (Mountain)" }), cls);
      const c = classes[cls].experiences;
      const r = raceByName("Dwarf (Mountain)");
      const { fixed, free } = experienceSlots(d);
      expect(fixed).toEqual([...c.fixed, ...r.bonusExperiences]);
      expect(free).toBe((c.total ?? 0) - c.fixed.length + (r.bonusExperienceChoices ?? 0));
    }
  });

  it("does not offer Experiences the character already has", () => {
    const d = withClass(base(), "Wizard");
    const fixed = experienceSlots(d).fixed.map((e) => e.toLowerCase());
    expect(experienceChoices(d).some((e) => fixed.includes(e.toLowerCase()))).toBe(false);
    expect(experienceChoices(d).length).toBeLessThanOrEqual(experiences.startingList.length);
  });
});

describe("equipment", () => {
  it("collects armour, shield and weapons from the chosen options", () => {
    const d: Draft = {
      ...withClass(base(), "Fighter"),
      choiceOne: "One-Handed Martial Melee and Light Crossbow",
      choiceTwo: "Chain Shirt and Shield",
      slotPicks: { "one:0": ["Long Sword"] },
      gold: { rolls: [3, 4], total: 7 },
    };
    const e = equipmentFor(d);
    expect(e.armour).toBe("Chain Shirt");
    expect(e.shield).toBe(true);
    expect(e.weapons).toEqual(["Long Sword", "Light Crossbow"]);
    expect(stepComplete(d, "equipment")).toBe(true);
    expect(stepComplete({ ...d, gold: null }, "equipment")).toBe(false);
    expect(stepComplete({ ...d, slotPicks: {} }, "equipment")).toBe(false);
  });

  it("Wizards have no Choice Two", () => {
    const d: Draft = { ...withClass(base(), "Wizard"), choiceOne: "Any two Wizard Weapons", slotPicks: { "one:0": ["Dagger", "Quarterstaff"] }, gold: { rolls: [1, 1], total: 2 } };
    expect(stepComplete(d, "equipment")).toBe(true);
  });
});

describe("spells", () => {
  it("a Wizard knows INT Languages spells at level 1", () => {
    const d = withClass(base(), "Wizard");
    expect(knownSpellCount(d)).toBeGreaterThan(0);
    expect(stepComplete(d, "spells")).toBe(false);
  });
});

describe("finished character", () => {
  it("round-trips through a file and keeps the specialization in damage", () => {
    const d: Draft = {
      ...withClass(base(), "Fighter"),
      specialization: "melee",
      experiences: Array.from({ length: experienceSlots(withClass(base(), "Fighter")).free }, (_, i) => `Exp ${i}`),
      choiceOne: "Two-Handed Martial Melee",
      choiceTwo: "Chain Mail",
      slotPicks: { "one:0": ["Great Axe"] },
      gold: { rolls: [2, 5], total: 7 },
    };
    expect(currentStep(d)).toBe("done");
    const c = toCharacter(d);
    expect(fromFileText(toFileText(c))).toEqual(c);
    const s = scores(d)!;
    const plain = deriveSheet({ race: c.race, cls: c.cls, level: 1, scores: s, armour: c.equipment.armour, shield: false, weapons: c.equipment.weapons });
    const spec = deriveSheet({ race: c.race, cls: c.cls, level: 1, scores: s, armour: c.equipment.armour, shield: false, weapons: c.equipment.weapons, specialization: "melee" });
    expect(plain.weapons[0]!.damage).not.toBe(spec.weapons[0]!.damage);
    const ranged = deriveSheet({ race: c.race, cls: c.cls, level: 1, scores: s, armour: null, shield: false, weapons: ["Long Bow"], specialization: "melee" });
    expect(ranged.weapons[0]!.damage).toBe(deriveSheet({ race: c.race, cls: c.cls, level: 1, scores: s, armour: null, shield: false, weapons: ["Long Bow"] }).weapons[0]!.damage);
  });
});
