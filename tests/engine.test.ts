import { describe, expect, it } from "vitest";
import { CLASS_NAMES, STATS, raceByName, type Stat } from "../src/rules";
import { EXPECTED_ROLL, ROLL_METHODS, capWasteChance, clampScore, finalScores, racialModifiers, rollForPick } from "../src/engine/abilities";
import { fixedRng, seededRng } from "../src/engine/dice";
import { OPTION_SLOTS, meetsStrength, optionAvailable, optionsFor, slotsFor, weaponByName, weaponsFor, WEAPON_FILTERS, type WeaponFilter } from "../src/engine/equipment";
import { armourClass, deriveSheet, level1Hp, statBonuses } from "../src/engine/derive";

const scores = (values: number[]) => Object.fromEntries(STATS.map((s, i) => [s, values[i]!])) as Record<Stat, number>;

describe("ability score rolling (original app method)", () => {
  it("uses fewer dice for each later pick", () => {
    expect(ROLL_METHODS.map((m) => m.label)).toEqual([
      "7d6 keep top 3",
      "6d6 keep top 3",
      "5d6 keep top 3",
      "4d6 keep top 3",
      "3d6",
      "2d6 twice, keep the higher total",
    ]);
  });

  it("has the exact expected values recorded for the original app", () => {
    expect(EXPECTED_ROLL.map((v) => v.toFixed(3))).toEqual(["14.903", "14.274", "13.430", "12.245", "10.500", "8.372"]);
  });

  it("keeps the top three dice", () => {
    const roll = rollForPick("STR", 0, fixedRng([1, 6, 2, 5, 3, 4, 1], 6));
    expect(roll.dice).toEqual([1, 6, 2, 5, 3, 4, 1]);
    expect(roll.kept).toEqual([6, 5, 4]);
    expect(roll.total).toBe(15);
  });

  it("keeps the higher of two 2d6 rolls on the sixth pick", () => {
    const roll = rollForPick("CHA", 5, fixedRng([2, 3, 6, 1], 6));
    expect(roll.total).toBe(7);
    expect(roll.kept).toEqual([6, 1]);
  });

  it("always rolls within the possible range", () => {
    const rng = seededRng(42);
    for (let i = 0; i < 2000; i++) {
      const pick = i % 6;
      const total = rollForPick("DEX", pick, rng).total;
      expect(total).toBeGreaterThanOrEqual(pick === 5 ? 2 : 3);
      expect(total).toBeLessThanOrEqual(pick === 5 ? 12 : 18);
    }
  });

  it("applies racial modifiers then holds scores to 6 to 18", () => {
    const goliath = racialModifiers(raceByName("Goliath"));
    const result = finalScores(scores([18, 5, 10, 10, 10, 10]), goliath);
    expect(result.STR).toBe(18);
    expect(result.DEX).toBe(6);
    expect(result.CON).toBe(11);
    expect(clampScore(3)).toBe(6);
  });

  it("requires two different picks for Human and Half-Elf", () => {
    expect(racialModifiers(raceByName("Human"), ["STR", "CON"])).toMatchObject({ STR: 1, CON: 1, DEX: 0 });
    expect(() => racialModifiers(raceByName("Human"), ["STR"])).toThrow();
    expect(() => racialModifiers(raceByName("Half-Elf"), ["STR", "STR"])).toThrow();
  });

  it("warns about wasted bonuses only when the roll can exceed 18", () => {
    expect(capWasteChance(0, 2)).toBeGreaterThan(0.04);
    expect(capWasteChance(5, 2)).toBe(0);
    expect(capWasteChance(0, 0)).toBe(0);
  });
});

describe("starting equipment", () => {
  it("maps every option in the sheet", () => {
    for (const cls of CLASS_NAMES) {
      const { choiceOne, choiceTwo } = optionsFor(cls);
      for (const option of [...choiceOne, ...choiceTwo]) expect(() => slotsFor(option), `${cls}: ${option}`).not.toThrow();
    }
  });

  it("only maps options that exist in the sheet", () => {
    const used = new Set(CLASS_NAMES.flatMap((cls) => [...optionsFor(cls).choiceOne, ...optionsFor(cls).choiceTwo]));
    for (const option of Object.keys(OPTION_SLOTS)) expect(used.has(option), option).toBe(true);
  });

  it("offers at least one weapon for every pick", () => {
    for (const filter of Object.keys(WEAPON_FILTERS) as WeaponFilter[]) expect(weaponsFor(filter).length, filter).toBeGreaterThan(0);
  });

  it("names only weapons and armour that are in the tables", () => {
    for (const slots of Object.values(OPTION_SLOTS)) {
      for (const slot of slots) {
        if (slot.kind === "weapon") expect(() => weaponByName(slot.name), slot.name).not.toThrow();
        if (slot.kind === "armour") for (const name of slot.options) expect(() => meetsStrength(name, 10), name).not.toThrow();
      }
    }
  });

  it("enforces armour Strength requirements", () => {
    expect(meetsStrength("Chain / Banded Mail", 12)).toBe(false);
    expect(meetsStrength("Chain / Banded Mail", 13)).toBe(true);
    expect(meetsStrength("Leather", 6)).toBe(true);
    expect(optionAvailable("Chain Mail", 12)).toBe(false);
    expect(optionAvailable("Chain Shirt and Shield", 6)).toBe(true);
  });

  it("splits melee and ranged weapons", () => {
    expect(weaponsFor("twoHandedMartialMelee").map((w) => w.name)).not.toContain("Long Bow");
    expect(weaponsFor("oneHandedMartialMelee").map((w) => w.name)).toContain("Long Sword");
    expect(weaponsFor("oneHandedMartialMelee").map((w) => w.name)).not.toContain("Hand Crossbow");
    expect(slotsFor("Scale Mail / Brigandine / Chain Shirt and One-Handed Martial")).toContainEqual({ kind: "pick", filter: "oneHandedMartialMelee", count: 1 });
    expect(weaponsFor("wizardWeapon").map((w) => w.name)).toEqual(["Dagger", "Quarterstaff", "Sickle", "Light Crossbow", "Sling", "Dart"]);
  });
});

describe("derived sheet values", () => {
  it("works out level 1 HP from the hit die and CON", () => {
    expect(level1Hp("Fighter", statBonuses(scores([10, 10, 18, 10, 10, 10]), "Fighter"))).toBe(14);
    expect(level1Hp("Wizard", statBonuses(scores([10, 10, 18, 10, 10, 10]), "Wizard"))).toBe(6);
    expect(level1Hp("Barbarian", statBonuses(scores([10, 10, 16, 10, 10, 10]), "Barbarian"))).toBe(16);
  });

  it("works out AC from armour, DEX and shield", () => {
    expect(armourClass("Fighter", "Leather", false, 3).total).toBe(14);
    expect(armourClass("Fighter", "Hide", true, 3).total).toBe(16);
    expect(armourClass("Fighter", "Plate", false, 3).total).toBe(18);
    expect(armourClass("Barbarian", null, true, 2).total).toBe(16);
  });

  it("builds a full level 1 Fighter", () => {
    const sheet = deriveSheet({
      race: "Dwarf (Hill)",
      cls: "Fighter",
      level: 1,
      scores: scores([16, 13, 16, 10, 13, 8]),
      armour: "Chain Shirt",
      shield: true,
      weapons: ["Long Sword", "Light Crossbow"],
    });
    expect(sheet.attackBonus).toBe(1);
    expect(sheet.hpMax).toBe(12);
    expect(sheet.ac.total).toBe(15);
    expect(sheet.weapons[0]).toMatchObject({ name: "Long Sword", hitBonus: 2, damage: "1d8/1d10 +2" });
    expect(sheet.weapons[1]).toMatchObject({ name: "Light Crossbow", ranged: true, hitBonus: 1, damage: "1d8" });
    expect(sheet.saves.magicItem).toEqual({ total: 15, base: 17, bonus: 2, notes: [] });
    // DEX always applies to Blast / Barrage, so it is in BNS and the total.
    expect(sheet.saves.blastBarrage.bonus).toBe(sheet.bonuses.blastSave);
    expect(sheet.saves.blastBarrage.total).toBe(sheet.saves.blastBarrage.base - sheet.bonuses.blastSave);
    expect(sheet.generalSaveNotes).toEqual(["+2 vs poison"]);
    expect(sheet.spellcasting).toBeNull();
  });

  it("works out Wizard spellcasting", () => {
    const sheet = deriveSheet({ race: "Elf (High)", cls: "Wizard", level: 1, scores: scores([8, 14, 12, 17, 10, 10]), armour: null, shield: false, weapons: ["Dagger"] });
    expect(sheet.spellcasting).toMatchObject({ spellAttack: 2, potency: -2, potencyKind: "arcane", slots: [2], cantrips: 3, wizardKnown: 6 });
  });
});
