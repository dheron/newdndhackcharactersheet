import { describe, expect, it } from "vitest";
import { STATS } from "../src/rules";
import type { StatRoll } from "../src/engine/abilities";
import { emptyDraft, toCharacter, withClass, experienceSlots, type Draft } from "../src/creation/draft";
import { fromFileText, toFileText, MELEE_ROWS, RANGED_ROWS } from "../src/model/character";
import { alignmentShort, sheetFor, slotTable, turnUndeadColumn } from "../src/sheet/derived";

const rolls = (values: number[]): StatRoll[] =>
  STATS.map((stat, pick) => ({ stat, pick, method: "test", dice: [values[pick]!], kept: [values[pick]!], total: values[pick]! }) as StatRoll);

function fighter(): Draft {
  const d: Draft = { ...withClass({ ...emptyDraft(), name: "Test", race: "Dwarf (Mountain)", alignment: "Lawful Good", raceConfirmed: true, rolls: rolls([16, 12, 15, 10, 13, 8]) }, "Fighter"), specialization: "melee" };
  return {
    ...d,
    experiences: Array.from({ length: experienceSlots(d).free }, (_, i) => `Exp ${i}`),
    choiceOne: "One-Handed Martial Melee and Light Crossbow",
    choiceTwo: "Chain Shirt and Shield",
    slotPicks: { "one:0": ["Long Sword"] },
    gold: { rolls: [3, 4], total: 7 },
  };
}

describe("the sheet from a saved character", () => {
  it("sorts starting weapons into melee and ranged rows", () => {
    const c = toCharacter(fighter());
    expect(c.play.melee.map((r) => r.name)).toEqual(["Long Sword", "", "", ""]);
    expect(c.play.ranged.map((r) => r.name)).toEqual(["Light Crossbow", "", ""]);
    expect(c.play.armour).toBe("Chain Shirt");
    expect(c.play.shield).toBe(true);
  });

  it("adds magic to hit and AC misc to AC", () => {
    const c = toCharacter(fighter());
    const before = sheetFor(c);
    const after = sheetFor({ ...c, play: { ...c.play, acMisc: 1, melee: c.play.melee.map((r, i) => (i === 0 ? { ...r, magic: 1 } : r)) } });
    expect(after.ac.total).toBe(before.ac.total + 1);
    expect(after.melee[0]!.line!.hitBonus).toBe(before.melee[0]!.line!.hitBonus + 1);
    expect(after.melee[0]!.line!.damage).toBe(before.melee[0]!.line!.damage);
    expect(after.melee[1]!.line).toBeNull();
  });

  it("lists fixed and chosen Experiences", () => {
    const c = toCharacter(fighter());
    expect(sheetFor(c).experiences).toContain("Stonecunning");
    expect(sheetFor(c).experiences).toContain("Exp 0");
  });

  it("opens a file saved before Alignment and play tracking existed", () => {
    const c = toCharacter(fighter());
    const { play: _play, alignment: _alignment, ...old } = c;
    const opened = fromFileText(JSON.stringify(old));
    expect(opened.alignment).toBe("");
    expect(opened.play.melee).toHaveLength(MELEE_ROWS);
    expect(opened.play.ranged).toHaveLength(RANGED_ROWS);
    expect(opened.play.inventory).toBe("Gold: 7 gp");
  });

  it("keeps play changes through a save", () => {
    const c = toCharacter(fighter());
    const played = { ...c, xp: 120, play: { ...c.play, hpCurrent: 4, prepared: ["Bless"], slotsSpent: [1] } };
    expect(fromFileText(toFileText(played))).toEqual(played);
  });
});

describe("page 2 helpers", () => {
  it("has slot boxes for the most slots the class ever has, and the ones it has now", () => {
    const cleric = slotTable("Cleric", 1);
    expect(cleric[0]).toMatchObject({ spellLevel: 1, now: 2 });
    expect(cleric[0]!.max).toBeGreaterThanOrEqual(2);
    expect(cleric[1]!.now).toBe(0);
    expect(slotTable("Fighter", 20)).toEqual([]);
  });

  it("picks the Turn Undead column, two levels lower for Paladins", () => {
    expect(turnUndeadColumn("Cleric", 1)).toBe(0);
    expect(turnUndeadColumn("Cleric", 11)).toBe(9);
    expect(turnUndeadColumn("Cleric", 20)).toBe(11);
    expect(turnUndeadColumn("Paladin", 2)).toBeNull();
    expect(turnUndeadColumn("Paladin", 3)).toBe(0);
    expect(turnUndeadColumn("Wizard", 5)).toBeNull();
  });

  it("shortens alignments for the header box", () => {
    expect(alignmentShort("Lawful Good")).toBe("LG");
    expect(alignmentShort("Neutral")).toBe("N");
  });
});

