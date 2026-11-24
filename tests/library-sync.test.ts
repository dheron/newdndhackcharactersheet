// The library's Google Drive sync, run against an in-memory stand-in for Drive and the browser's storage.
import { beforeEach, describe, expect, it, vi } from "vitest";

const store = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() {
    return store.size;
  },
});

const remote = new Map<string, { characterId: string; updatedAt: string; text: string }>();
let nextId = 1;
vi.mock("../src/sync/drive", () => {
  const sets = new Map<string, Set<string>>();
  return {
    driveAvailable: () => true,
    driveConnected: () => true,
    connectDrive: async () => undefined,
    syncedIds: () => new Set(sets.get("synced") ?? []),
    setSyncedIds: (s: Set<string>) => sets.set("synced", new Set(s)),
    deletedIds: () => new Set(sets.get("deleted") ?? []),
    setDeletedIds: (s: Set<string>) => sets.set("deleted", new Set(s)),
    noteDeleted: (id: string) => sets.set("deleted", new Set([...(sets.get("deleted") ?? []), id])),
    NeedsSignIn: class extends Error {},
    listRemote: async () => [...remote.entries()].map(([fileId, f]) => ({ id: f.characterId, fileId, updatedAt: f.updatedAt })),
    download: async (fileId: string) => remote.get(fileId)!.text,
    upload: async (meta: { id: string; updatedAt: string }, text: string, fileId?: string) => {
      const id = fileId ?? `file-${nextId++}`;
      remote.set(id, { characterId: meta.id, updatedAt: meta.updatedAt, text });
      return id;
    },
    remove: async (fileId: string) => void remote.delete(fileId),
  };
});

const { STATS } = await import("../src/rules");
const { emptyDraft, toCharacter, withClasses } = await import("../src/creation/draft");
const { toFileText } = await import("../src/model/character");
const library = await import("../src/library");

const make = (name: string) => {
  const rolls = STATS.map((stat, pick) => ({ stat, pick, method: "t", dice: [12], kept: [12], total: 12 }));
  const d = withClasses({ ...emptyDraft(), name, race: "Dwarf (Hill)", alignment: "Neutral", raceConfirmed: true, rolls }, ["Fighter"]);
  return toCharacter({ ...d, equipmentClass: "Fighter", specialization: "melee", gold: { rolls: [1, 1], total: 2 } });
};

describe("library sync with Google Drive", () => {
  beforeEach(() => {
    store.clear();
    remote.clear();
  });

  it("uploads on save, brings in characters from another device, and follows deletions", async () => {
    const a = make("Ada");
    expect(await library.saveCharacter(a)).toBe("saved");
    expect([...remote.values()].map((f) => f.characterId)).toEqual([a.id]);

    // Another device adds Bo to Drive.
    const b = { ...make("Bo"), updatedAt: new Date(Date.now() + 1000).toISOString() };
    remote.set("file-other", { characterId: b.id, updatedAt: b.updatedAt, text: toFileText(b) });
    const r = await library.syncWithDrive(false);
    expect(r.downloaded).toBe(1);
    expect((await library.listCharacters()).characters.map((c) => c.name)).toEqual(["Ada", "Bo"]);

    // Bo is deleted here: the Drive copy goes too.
    await library.deleteCharacter(b.id);
    expect([...remote.values()].map((f) => f.characterId)).toEqual([a.id]);

    // Ada is deleted on another device: the next sync removes her here.
    remote.clear();
    await library.syncWithDrive(false);
    expect((await library.listCharacters()).characters).toEqual([]);
  });

  it("keeps the newer copy when both sides changed", async () => {
    const a = make("Ada");
    await library.saveCharacter(a);
    const [fileId, f] = [...remote.entries()][0]!;
    const newer = { ...JSON.parse(f.text), xp: 500, updatedAt: new Date(Date.now() + 5000).toISOString() };
    remote.set(fileId, { characterId: a.id, updatedAt: newer.updatedAt, text: toFileText(newer) });
    await library.syncWithDrive(false);
    expect((await library.loadCharacter(a.id)).xp).toBe(500);
  });
});
