import { describe, expect, it } from "vitest";
import { planSync } from "../src/sync/merge";
import { charactersFromText, toBackupText, toFileText } from "../src/model/character";
import { STATS } from "../src/rules";
import type { StatRoll } from "../src/engine/abilities";
import { emptyDraft, toCharacter, withClasses } from "../src/creation/draft";

const L = (id: string, updatedAt: string) => ({ id, updatedAt });
const R = (id: string, updatedAt: string) => ({ id, fileId: `f-${id}`, updatedAt });

describe("syncing with Google Drive", () => {
  it("keeps the newer copy of each character", () => {
    const plan = planSync([L("a", "2026-01-02"), L("b", "2026-01-01"), L("c", "2026-01-01")], [R("a", "2026-01-01"), R("b", "2026-01-03"), R("c", "2026-01-01")], new Set(["a", "b", "c"]), new Set());
    expect(plan.upload).toEqual(["a"]);
    expect(plan.download.map((r) => r.id)).toEqual(["b"]);
    expect(plan.deleteLocal).toEqual([]);
  });

  it("uploads new characters and downloads ones made on another device", () => {
    const plan = planSync([L("new", "2026-01-01")], [R("other", "2026-01-01")], new Set(), new Set());
    expect(plan.upload).toEqual(["new"]);
    expect(plan.download.map((r) => r.id)).toEqual(["other"]);
  });

  it("follows deletions made on either device", () => {
    // "gone" was synced before and is no longer in Drive: deleted elsewhere. "binned" was deleted here.
    const plan = planSync([L("gone", "2026-01-01")], [R("binned", "2026-01-01")], new Set(["gone", "binned"]), new Set(["binned"]));
    expect(plan.deleteLocal).toEqual(["gone"]);
    expect(plan.deleteRemote.map((r) => r.id)).toEqual(["binned"]);
    expect(plan.upload).toEqual([]);
    expect(plan.download).toEqual([]);
  });

  it("treats files saved before times were recorded as the oldest", () => {
    const plan = planSync([L("a", "")], [R("a", "2026-01-01")], new Set(["a"]), new Set());
    expect(plan.download.map((r) => r.id)).toEqual(["a"]);
  });
});

describe("backup files", () => {
  const rolls = STATS.map((stat, pick) => ({ stat, pick, method: "t", dice: [12], kept: [12], total: 12 }) as StatRoll);
  const make = (name: string) => {
    const d = withClasses({ ...emptyDraft(), name, race: "Dwarf (Hill)", alignment: "Neutral", raceConfirmed: true, rolls }, ["Cleric"]);
    return toCharacter({ ...d, equipmentClass: "Cleric", gold: { rolls: [1, 1], total: 2 } });
  };

  it("reads back every character from a backup, and a single character file", () => {
    const a = make("Ada");
    const b = make("Bo");
    expect(charactersFromText(toBackupText([a, b])).map((c) => c.name)).toEqual(["Ada", "Bo"]);
    expect(charactersFromText(toFileText(a)).map((c) => c.id)).toEqual([a.id]);
  });
});
