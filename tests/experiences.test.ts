import { describe, expect, it } from "vitest";
import { expandedExperiences } from "../src/rules";
import { seededRng } from "../src/engine/dice";
import { EXTRA_EXAMPLES, PER_SECTION, coreSkillOptions, experiencePool, randomExamples, startingExamples } from "../src/creation/experienceOptions";

const sectionOf = new Map(experiencePool().map((e) => [e.name, e.section]));

describe("Expanded Experiences doc", () => {
  it("has the core skills, default examples and four sections, with Section 4 phrases trimmed", () => {
    expect(expandedExperiences.coreSkills[0]).toBe("Athletics");
    expect(expandedExperiences.defaultExamples).toHaveLength(15);
    expect(expandedExperiences.sections.map((s) => s.number)).toEqual([1, 2, 3, 4]);
    const phrases = expandedExperiences.sections[3]!.groups.flatMap((g) => g.items);
    expect(phrases).toContain("I've Had Worse");
    expect(phrases.some((p) => p.includes("("))).toBe(false);
  });
});

describe("Experiences step options", () => {
  it("leaves out core skills the character already has", () => {
    expect(coreSkillOptions(["Arcana", "religion"])).not.toContain("Arcana");
    expect(coreSkillOptions(["Arcana", "religion"])).not.toContain("Religion");
  });

  it("opens with the Default Examples, then a few random entries", () => {
    const ex = startingExamples([], seededRng(1));
    expect(ex.slice(0, 15)).toEqual(expandedExperiences.defaultExamples);
    expect(ex).toHaveLength(15 + EXTRA_EXAMPLES);
    expect(new Set(ex).size).toBe(ex.length);
  });

  it("Randomize gives an even mix from every section, with no core skills or repeats", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const ex = randomExamples(["Stonecunning"], seededRng(seed));
      expect(ex).toHaveLength(PER_SECTION * 4);
      expect(new Set(ex).size).toBe(ex.length);
      for (const n of [1, 2, 3, 4]) expect(ex.filter((e) => sectionOf.get(e) === n), `section ${n}`).toHaveLength(PER_SECTION);
      expect(ex.some((e) => expandedExperiences.coreSkills.includes(e))).toBe(false);
    }
  });
});
