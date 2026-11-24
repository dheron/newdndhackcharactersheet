import { describe, expect, it } from "vitest";
import report from "../docs/rules-report.md?raw";
import { STATS, races } from "../src/rules";
import { multiclassOptions } from "../src/engine/multiclass";
import type { StatRoll } from "../src/engine/abilities";
import { emptyDraft, toCharacter, withClass, experienceSlots, type Draft } from "../src/creation/draft";
import { fromFileText, toFileText, MELEE_ROWS, RANGED_ROWS } from "../src/model/character";
import { alignmentShort, classAndLevel, sheetFor, slotTable, turnUndeadColumn } from "../src/sheet/derived";

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

  it("opens a file saved before Alignment, play tracking and multiclassing existed", () => {
    const c = toCharacter(fighter());
    const { play: _play, alignment: _alignment, classes: _classes, levels: _levels, equipmentClass: _ec, cantrips: _cantrips, ...rest } = c;
    const old = { ...rest, cls: "Fighter", level: 1, cantrips: [], play: { prepared: ["Bless"], slotsSpent: [1], spellAttackMisc: 0 } };
    const opened = fromFileText(JSON.stringify(old));
    expect(opened.classes).toEqual(["Fighter"]);
    expect(opened.levels).toEqual([1]);
    expect(opened.equipmentClass).toBe("Fighter");
    expect(opened.play.casting.Fighter).toEqual({ prepared: ["Bless"], slotsSpent: [1], spellAttackMisc: 0 });
    expect("cls" in opened).toBe(false);
    expect(opened.alignment).toBe("");
    expect(opened.play.melee).toHaveLength(MELEE_ROWS);
    expect(opened.play.ranged).toHaveLength(RANGED_ROWS);
    expect(opened.play.inventory).toBe("Gold: 7 gp");
  });

  it("keeps play changes through a save", () => {
    const c = toCharacter(fighter());
    const played = { ...c, xp: 120, play: { ...c.play, hpCurrent: 4, casting: { Cleric: { prepared: ["Bless"], slotsSpent: [1], spellAttackMisc: 0 } } } };
    expect(fromFileText(toFileText(played))).toEqual(played);
  });
});

describe("a multiclass sheet", () => {
  it("shows every class, its hit dice and a page 2 for each caster", () => {
    const c = { ...toCharacter(fighter()), classes: ["Cleric", "Wizard"] as const, levels: [1, 1] };
    const v = sheetFor({ ...c, classes: [...c.classes] });
    expect(classAndLevel({ ...c, classes: [...c.classes] })).toBe("Cleric 1 / Wizard 1");
    expect(v.hitDice.map((h) => h.cls)).toEqual(["Cleric", "Wizard"]);
    expect(v.casters.map((x) => x.cls)).toEqual(["Cleric", "Wizard"]);
    expect(v.abilities.some((a) => a.startsWith("Wizard: "))).toBe(true);
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


describe("rules report", () => {
  it("lists the same multiclass combinations the app offers", () => {
    for (const r of races) {
      const row = [...report.split("\n")].reverse().find((l: string) => l.startsWith(`| ${r.name} |`) && l.split("|").length > 5);
      expect(row, r.name).toBeDefined();
      expect(row!.split("|").at(-2)!.trim(), r.name).toBe(multiclassOptions(r.name).map((c) => c.join("/")).join(", "));
    }
  });
});
