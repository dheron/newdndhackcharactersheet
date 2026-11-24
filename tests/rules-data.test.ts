import { describe, expect, it } from "vitest";
import {
  CLASS_NAMES,
  STATS,
  abilitiesUpTo,
  abilityValue,
  armour,
  attackBonus,
  cantripsKnown,
  classes,
  hitDie,
  isWarrior,
  raceByName,
  races,
  saveTargets,
  spellSlots,
  spells,
  startingOptions,
  weapons,
} from "../src/rules";
import abilityData from "../src/rules/data/ability-scores.json";

// Shape checks catch transcription slips (a missing row, a short table).
// Spot checks compare single values against the Drive docs.

describe("ability score tables", () => {
  it("has 22 entries (scores 3 to 24) in every column", () => {
    for (const stat of STATS) {
      const columns = (abilityData as unknown as Record<string, Record<string, unknown>>)[stat]!;
      for (const [name, column] of Object.entries(columns)) {
        if (Array.isArray(column) && typeof column[0] === "number") expect(column, `${stat} ${name}`).toHaveLength(22);
      }
    }
  });

  it("matches doc values", () => {
    expect(abilityValue("STR", "damage", 18)).toBe(5);
    expect(abilityValue("STR", "meleeHit", 15)).toBe(1);
    expect(abilityValue("DEX", "ac", 14)).toBe(1);
    expect(abilityValue("CON", "hpPerHitDieWarrior", 18)).toBe(4);
    expect(abilityValue("CON", "hpPerHitDie", 18)).toBe(2);
    expect(abilityValue("INT", "languages", 24)).toBe(15);
    expect(abilityValue("INT", "arcanePotency", 3)).toBe(3);
    expect(abilityValue("WIS", "mindSpellSave", 5)).toBe(-1);
  });

  it("rejects scores outside 3 to 24", () => {
    expect(() => abilityValue("STR", "damage", 2)).toThrow(RangeError);
    expect(() => abilityValue("STR", "damage", 25)).toThrow(RangeError);
  });

  it("marks the four warrior classes for the CON column", () => {
    expect(CLASS_NAMES.filter(isWarrior)).toEqual(["Fighter", "Barbarian", "Paladin", "Ranger"]);
  });
});

describe("classes", () => {
  it("has 20 levels in every per-level table", () => {
    for (const cls of CLASS_NAMES) {
      const c = classes[cls];
      expect(c.xp, `${cls} xp`).toHaveLength(20);
      expect(c.attackBonus, `${cls} attack`).toHaveLength(20);
      expect(c.hp, `${cls} hp`).toHaveLength(20);
      if (c.spellSlots) expect(c.spellSlots, `${cls} slots`).toHaveLength(20);
      if (c.spellAttack) expect(c.spellAttack, `${cls} spell attack`).toHaveLength(20);
    }
  });

  it("has XP that starts at 0 and always rises", () => {
    for (const cls of CLASS_NAMES) {
      const xp = classes[cls].xp;
      expect(xp[0]).toBe(0);
      for (let i = 1; i < xp.length; i++) expect(xp[i]!, `${cls} level ${i + 1}`).toBeGreaterThan(xp[i - 1]!);
    }
  });

  it("never lowers attack bonus or slot counts as level rises", () => {
    for (const cls of CLASS_NAMES) {
      const c = classes[cls];
      for (let i = 1; i < 20; i++) {
        expect(c.attackBonus[i]!).toBeGreaterThanOrEqual(c.attackBonus[i - 1]!);
        const prev = c.spellSlots?.[i - 1] ?? [];
        const cur = c.spellSlots?.[i] ?? [];
        prev.forEach((n, lvl) => expect(cur[lvl] ?? 0, `${cls} level ${i + 1} slot ${lvl + 1}`).toBeGreaterThanOrEqual(n));
      }
    }
  });

  it("matches doc values", () => {
    expect(hitDie("Fighter")).toBe(10);
    expect(hitDie("Barbarian")).toBe(12);
    expect(hitDie("Bard")).toBe(6);
    expect(hitDie("Wizard")).toBe(4);
    expect(attackBonus("Cleric", 1)).toBe(0);
    expect(attackBonus("Fighter", 20)).toBe(12);
    expect(spellSlots("Wizard", 20)).toEqual([5, 5, 5, 5, 5, 4, 3, 3, 2]);
    expect(spellSlots("Paladin", 1)).toEqual([]);
    expect(spellSlots("Cleric", 20)).toEqual([9, 9, 9, 8, 7, 5, 2]);
    expect(classes.Wizard.spellAttack?.[0]).toBe(0);
    expect(classes.Barbarian.xp[1]).toBe(2000);
    expect(classes.Thief.experiences.total).toBe(9);
  });

  it("counts cantrips from the class table", () => {
    expect(cantripsKnown("Wizard", 1)).toBe(3);
    expect(cantripsKnown("Wizard", 13)).toBe(5);
    expect(cantripsKnown("Cleric", 4)).toBe(2);
    expect(cantripsKnown("Cleric", 5)).toBe(3);
    expect(cantripsKnown("Fighter", 20)).toBe(0);
  });

  it("lists abilities gained up to a level", () => {
    expect(abilitiesUpTo("Fighter", 1).map((a) => a.text)).toEqual(["Weapon Specialization: +2 damage to either melee or ranged attack (pick one)."]);
    expect(abilitiesUpTo("Fighter", 3)).toHaveLength(2);
  });

  it("rejects levels outside 1 to 20", () => {
    expect(() => attackBonus("Fighter", 0)).toThrow(RangeError);
    expect(() => saveTargets("Fighter", 21)).toThrow(RangeError);
  });
});

describe("saving throws", () => {
  it("never get harder as level rises", () => {
    for (const cls of CLASS_NAMES) {
      for (let level = 2; level <= 20; level++) {
        const prev = saveTargets(cls, level - 1);
        const cur = saveTargets(cls, level);
        for (const key of Object.keys(cur) as (keyof typeof cur)[]) {
          expect(cur[key], `${cls} level ${level} ${key}`).toBeLessThanOrEqual(prev[key]);
        }
      }
    }
  });

  it("matches doc values", () => {
    expect(saveTargets("Fighter", 1)).toEqual({ deathParalyze: 15, magicItem: 17, petrificationPolymorph: 16, blastBarrage: 14, spell: 18 });
    expect(saveTargets("Wizard", 1)).toEqual({ deathParalyze: 17, magicItem: 14, petrificationPolymorph: 16, blastBarrage: 17, spell: 12 });
    expect(saveTargets("Thief", 20).blastBarrage).toBe(3);
    expect(saveTargets("Druid", 1).petrificationPolymorph).toBe(11);
  });
});

describe("races", () => {
  it("has the 17 races in the doc", () => {
    expect(races).toHaveLength(17);
  });

  it("uses only known stats in modifiers", () => {
    for (const race of races) {
      for (const stat of Object.keys(race.modifiers)) expect(STATS).toContain(stat);
    }
  });

  it("matches doc values", () => {
    expect(raceByName("Goliath").modifiers).toEqual({ STR: 2, DEX: -1, CON: 1, CHA: -1 });
    expect(raceByName("Tiefling").modifiers).toEqual({ INT: 1, CHA: 1, WIS: -1 });
    expect(raceByName("Human").chooseTwo).toBe(true);
    expect(raceByName("Half-Elf").bonusExperienceChoices).toBe(2);
    expect(raceByName("Elf (Wood)").bonusExperiences).toEqual(["Woodland Stealth", "Tracking"]);
  });
});

describe("equipment", () => {
  it("has starting options for every class", () => {
    for (const cls of CLASS_NAMES) expect(startingOptions[cls]?.choiceOne.length, cls).toBeGreaterThan(0);
  });

  it("matches doc values", () => {
    expect(weapons.find((w) => w.name === "Long Sword")?.damage).toBe("1d8/1d10");
    expect(weapons.find((w) => w.name === "Long Bow")?.range).toBe("150/600");
    expect(armour.find((a) => a.name === "Plate")?.baseAC).toBe(18);
    expect(armour.find((a) => a.name === "Chain / Banded Mail")?.strReq).toBe(13);
    expect(armour.find((a) => a.name === "Hide")?.dexCap).toBe(2);
  });
});

describe("spells", () => {
  it("has the spell counts from each spellbook", () => {
    const counts = (cls: keyof typeof spells) =>
      Object.entries(spells[cls]!.levels).map(([lvl, list]) => `${lvl}:${list.length}`).join(" ");
    expect(counts("Wizard")).toBe("0:11 1:40 2:39 3:42 4:29 5:25 6:24 7:21 8:12 9:12");
    expect(counts("Cleric")).toBe("0:6 1:21 2:16 3:27 4:5 5:14 6:11 7:13");
    expect(counts("Druid")).toBe("0:6 1:20 2:16 3:18 4:20 5:13 6:9 7:6");
    expect(counts("Bard")).toBe("0:9 1:27 2:38 3:24 4:11 5:17 6:10");
    expect(counts("Paladin")).toBe("1:17 2:13 3:13 4:8 5:9");
    expect(counts("Ranger")).toBe("1:18 2:13 3:17 4:6 5:7");
  });

  it("has no duplicate spell in a level", () => {
    for (const [cls, data] of Object.entries(spells)) {
      for (const [lvl, list] of Object.entries(data!.levels)) expect(new Set(list).size, `${cls} ${lvl}`).toBe(list.length);
    }
  });

  it("only lists spell levels the class has slots for", () => {
    for (const cls of CLASS_NAMES) {
      const list = spells[cls];
      if (!list) continue;
      const maxSlotLevel = Math.max(...classes[cls].spellSlots!.map((s) => s.length));
      for (const lvl of Object.keys(list.levels).map(Number)) expect(lvl, cls).toBeLessThanOrEqual(maxSlotLevel);
    }
  });
});
