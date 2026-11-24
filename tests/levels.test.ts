import { describe, expect, it } from "vitest";
import { STATS } from "../src/rules";
import type { StatRoll } from "../src/engine/abilities";
import { statBonuses } from "../src/engine/derive";
import {
  addXp,
  applyLevelUp,
  choicesFor,
  classXp,
  hpGain,
  hpStep,
  readyToLevel,
  secretOptions,
  undoLevelUp,
  wizardSpellOptions,
  xpWithBonus,
} from "../src/engine/levels";
import { emptyDraft, experienceSlots, toCharacter, withClasses, type Draft } from "../src/creation/draft";
import { characterScores, sheetFor } from "../src/sheet/derived";
import type { Character } from "../src/model/character";

const rolls = (values: number[]): StatRoll[] => STATS.map((stat, pick) => ({ stat, pick, method: "t", dice: [values[pick]!], kept: [values[pick]!], total: values[pick]! }) as StatRoll);

function make(classes: Draft["classes"], race = "Dwarf (Mountain)"): Character {
  let d: Draft = { ...emptyDraft(), name: "L", race, raceChoices: race === "Human" ? ["STR", "INT"] : [], alignment: "Neutral", raceConfirmed: true, rolls: rolls([15, 14, 16, 16, 14, 10]), multiclass: classes.length > 1 };
  d = withClasses(d, classes);
  d = { ...d, specialization: "melee", equipmentClass: classes[0]!, experiences: Array.from({ length: experienceSlots(d).free }, (_, i) => `E${i}`), gold: { rolls: [1, 1], total: 2 } };
  return toCharacter({ ...d, choiceOne: null });
}

describe("XP", () => {
  it("adds the Human +20% and splits XP between classes", () => {
    expect(xpWithBonus("Human", 100)).toBe(120);
    expect(xpWithBonus("Dwarf (Hill)", 100)).toBe(100);
    const c = addXp(make(["Fighter", "Thief"]), 700);
    expect(c.xp).toBe(700);
    expect(classXp(c)).toBe(350);
    // Fighter 2nd needs 300, Thief 2nd needs 170 (Classes v4): both are ready.
    expect(readyToLevel(c)).toEqual([0, 1]);
    expect(readyToLevel(addXp(make(["Fighter"]), 299))).toEqual([]);
  });
});

describe("HP for a level", () => {
  it("rolls a hit die to 10th, then adds the flat step with no CON", () => {
    expect(hpStep("Fighter", 2)).toEqual({ kind: "roll", die: 10 });
    expect(hpStep("Fighter", 10)).toEqual({ kind: "roll", die: 10 });
    expect(hpStep("Fighter", 11)).toEqual({ kind: "flat", amount: 3 });
    expect(hpStep("Wizard", 12)).toEqual({ kind: "flat", amount: 1 });
    const b = statBonuses({ STR: 10, DEX: 10, CON: 18, INT: 10, WIS: 10, CHA: 10 });
    expect(hpGain("Fighter", { kind: "roll", die: 10 }, 7, 1, b)).toBe(7 + b.hpPerHitDieWarrior);
    expect(hpGain("Fighter", { kind: "flat", amount: 3 }, null, 1, b)).toBe(3);
    // Multiclass: shared between the classes, never below 1.
    expect(hpGain("Fighter", { kind: "flat", amount: 3 }, null, 2, b)).toBe(1);
    expect(() => hpGain("Fighter", { kind: "roll", die: 10 }, 11, 1, b)).toThrow();
  });
});

describe("gaining a level", () => {
  it("lists new abilities and picks, applies them and can undo", () => {
    let c = addXp(make(["Wizard"], "Human"), 5000);
    const ch = choicesFor(c, 0);
    expect(ch).toMatchObject({ cls: "Wizard", newLevel: 2, cantrips: 0, knownSpells: 1, expertise: 0, magicalSecrets: 0 });
    const spell = wizardSpellOptions(c, 2)[0]!;
    const maxBefore = sheetFor(c).hpMax!;
    c = { ...c, play: { ...c.play, hpCurrent: 3 } };
    const after = applyLevelUp(c, 0, { roll: 3, hpGain: 4, cantrips: [], knownSpells: [spell], expertise: [], magicalSecrets: [] });
    expect(after.levels).toEqual([2]);
    expect(after.knownSpells).toContain(spell);
    expect(sheetFor(after).hpMax).toBe(maxBefore + 4);
    expect(after.play.hpCurrent).toBe(7);
    const undone = undoLevelUp(after);
    expect(undone.levels).toEqual([1]);
    expect(undone.knownSpells).not.toContain(spell);
    expect(undone.play.hpCurrent).toBe(3);
    expect(undone.levelUps).toEqual([]);
  });

  it("asks for a new cantrip, Expertise and Magical Secrets at the right levels", () => {
    const at = (c: Character, level: number) => ({ ...c, levels: [level - 1] });
    expect(choicesFor(at(make(["Cleric"]), 5), 0).cantrips).toBe(1);
    expect(choicesFor(at(make(["Thief"]), 6), 0).expertise).toBe(2);
    expect(choicesFor(at(make(["Thief"]), 5), 0).expertise).toBe(0);
    expect(choicesFor(at(make(["Bard"]), 4), 0).magicalSecrets).toBe(1);
    const secrets = secretOptions(make(["Bard"])).map((s) => s.spell);
    // Any spell from any class, any level (David): a 9th level Wizard spell and a Bard spell are both offered.
    expect(secrets).toContain("Wish");
    expect(secrets.length).toBe(new Set(secrets).size);
  });

  it("keeps the scores used for CON the same as the sheet", () => {
    const c = make(["Fighter"]);
    expect(characterScores(c).CON).toBe(sheetFor(c).scores.CON);
  });
});
