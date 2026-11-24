import { describe, expect, it } from "vitest";
import report from "../docs/rules-report.md?raw";
import { CLASS_NAMES, STATS, abilitiesUpTo, decisions, races } from "../src/rules";
import { multiclassOptions } from "../src/engine/multiclass";
import type { StatRoll } from "../src/engine/abilities";
import { emptyDraft, toCharacter, withClass, experienceSlots, type Draft } from "../src/creation/draft";
import { fromFileText, initialPlay, toFileText, MELEE_ROWS, RANGED_ROWS } from "../src/model/character";
import { alignmentShort, classAndLevel, equipBlocked, equippable, inventoryOf, isEquipped, sheetFor, slotTable, toggleEquip, turnUndeadColumn } from "../src/sheet/derived";
import { canWear, cannotWearReason, restrictionsFor } from "../src/engine/equipment";

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

  it("gives two of the same weapon one row, and lists the starting equipment in the inventory", () => {
    const play = initialPlay({ equipment: { armour: null, shield: false, weapons: ["Dagger", "Dagger", "Light Crossbow"] }, gold: 4 });
    expect(play.melee.map((r) => r.name)).toEqual(["Dagger", "", "", ""]);
    expect(play.ranged.map((r) => r.name)).toEqual(["Light Crossbow", "", ""]);
    expect(play.inventory).toEqual(["2 x Dagger", "Light Crossbow", "Gold: 4 gp"]);
  });

  it("keeps the Human XP bonus on the abilities list", () => {
    const c = { ...toCharacter(fighter()), race: "Human", raceChoices: ["STR", "CON"] as ("STR" | "CON")[] };
    expect(sheetFor(c).abilities.map((a) => a.text)).toContain("+20% experience points gained");
    expect(sheetFor(c).abilities.some((a) => a.text.startsWith("+1 to any two"))).toBe(false);
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
    expect(opened.play.inventory).toEqual(["Chain Shirt", "Shield", "Long Sword", "Light Crossbow", "Gold: 7 gp"]);
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
    expect(v.abilities.some((a) => a.text.startsWith("Cleric: Turn Undead"))).toBe(true);
    // Cantrip counts are rules (shown on page 2), not abilities.
    expect(v.abilities.some((a) => a.text.includes("Cantrip"))).toBe(false);
  });
});

describe("abilities list", () => {
  it("leaves rules off and lists every rule text that exists in the data", () => {
    const texts = new Set([...CLASS_NAMES.flatMap((c) => abilitiesUpTo(c, 20).map((a) => a.text)), ...races.flatMap((r) => r.traits)]);
    for (const t of [...decisions.notOnAbilityList.rules, ...decisions.notOnAbilityList.languages]) expect(texts.has(t), t).toBe(true);
  });

  it("shows Thieves' Cant as a language, not an ability", () => {
    const c = { ...toCharacter(fighter()), classes: ["Thief" as const], levels: [1] };
    const v = sheetFor(c);
    expect(v.languages).toEqual(["Thieves Cant\u2019"]);
    expect(v.abilities.some((a) => a.text.startsWith("Thieves Cant") || a.text.startsWith("Expertise"))).toBe(false);
    expect(v.abilities.map((a) => a.text)).toContain("Backstab (x2 damage)");
    // The Dwarf bonus Experience is a rule; save bonus traits stay (David).
    expect(v.abilities.map((a) => a.text)).toEqual(["Backstab (x2 damage)", "Dwarves have darkvision to 60 feet.", "+2 on saves against poison and +2 on Magic Item saves against magic items."]);
  });
});

describe("equipping from the inventory", () => {
  it("renames the old combined armour and weapon names when opening a file", () => {
    const c = toCharacter(fighter());
    const old = { ...c, equipment: { ...c.equipment, armour: "Chain / Banded Mail" }, play: { ...c.play, armour: "Chain / Banded Mail", inventory: ["Chain / Banded Mail", "2 x Ranseur/Pike"] } };
    const opened = fromFileText(JSON.stringify(old));
    expect(opened.equipment.armour).toBe("Chain Mail");
    expect(opened.play.armour).toBe("Chain Mail");
    expect(opened.play.inventory).toEqual(["Chain Mail", "2 x Ranseur"]);
  });

  it("equips and unequips armour, shields and weapons", () => {
    let c = toCharacter(fighter());
    c = { ...c, play: { ...c.play, inventory: [...c.play.inventory, "Plate", "2 x Dagger"] } };
    expect(inventoryOf(c, "armour")).toEqual(["Chain Shirt", "Plate"]);
    expect(isEquipped(c, { kind: "armour", name: "Chain Shirt" })).toBe(true);
    c = toggleEquip(c, { kind: "armour", name: "Plate" });
    expect(c.play.armour).toBe("Plate");
    c = toggleEquip(c, { kind: "shield", name: "Shield" });
    expect(c.play.shield).toBe(false);
    const dagger = equippable("2 x Dagger")!;
    expect(dagger).toEqual({ kind: "melee", name: "Dagger" });
    c = toggleEquip(c, dagger);
    expect(c.play.melee.map((r) => r.name)).toEqual(["Long Sword", "Dagger", "", ""]);
    c = toggleEquip(c, dagger);
    expect(c.play.melee.map((r) => r.name)).toEqual(["Long Sword", "", "", ""]);
    expect(equippable("Rope")).toBeNull();
  });

  it("blocks armour the classes cannot wear, and Druids never wear metal", () => {
    const wiz = { ...toCharacter(fighter()), classes: ["Wizard" as const], levels: [1] };
    expect(equipBlocked(wiz, { kind: "armour", name: "Leather" })).not.toBeNull();
    const fd = { ...toCharacter(fighter()), classes: ["Fighter" as const, "Druid" as const], levels: [1, 1] };
    expect(canWear(fd.classes, "Chain Mail")).toBe(false);
    expect(canWear(fd.classes, "Hide")).toBe(true);
    expect(canWear(fd.classes, "Shield")).toBe(true);
    expect(cannotWearReason(fd.classes, "Plate")).toMatch(/non-metal/);
  });

  it("flags abilities and spellcasting a multiclass restriction switches off", () => {
    const base = toCharacter(fighter());
    const fw = { ...base, classes: ["Fighter" as const, "Wizard" as const], levels: [1, 1], play: { ...base.play, armour: "Chain Mail" } };
    expect(sheetFor(fw).castingOff.Wizard).toMatch(/heavy armour/);
    expect(sheetFor({ ...fw, play: { ...fw.play, armour: null } }).castingOff.Wizard).toBeUndefined();
    const ft = { ...base, classes: ["Fighter" as const, "Thief" as const], levels: [1, 1], play: { ...base.play, armour: "Chain Shirt" } };
    const backstab = sheetFor(ft).abilities.find((a) => a.text.startsWith("Thief: Backstab"))!;
    expect(backstab.off).toMatch(/medium armour/);
    expect(restrictionsFor(["Fighter"], "Plate")).toEqual([]);
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
