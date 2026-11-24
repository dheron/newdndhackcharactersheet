// Everything the sheet shows that is worked out from the saved character and the rules data.
import { classes, decisions, isWarrior, multiclass, raceByName, spellSlots, turnUndead, type ClassName, type Stat } from "../rules";
import { finalScores, racialModifiers } from "../engine/abilities";
import { armourClass, deriveSheet, weaponLine, type ClassLevel } from "../engine/derive";
import { classesLabel } from "../engine/multiclass";
import { experienceSlotsFor } from "../creation/draft";
import { rolledScores, type Character, type WeaponRow } from "../model/character";

export function characterScores(c: Character): Record<Stat, number> {
  return finalScores(rolledScores(c.rolls), racialModifiers(raceByName(c.race), c.raceChoices));
}

export function alignmentShort(name: string): string {
  return decisions.alignments.list.find((a) => a.name === name)?.short ?? name;
}

export interface WeaponRowView {
  row: WeaponRow;
  /** Null for an empty row. */
  line: ReturnType<typeof weaponLine> | null;
}

export function classLevels(c: Character): ClassLevel[] {
  return c.classes.map((cls, i) => ({ cls, level: c.levels[i] ?? 1 }));
}

/** "Fighter 1" or "Fighter 1 / Thief 1". */
export function classAndLevel(c: Character): string {
  return classLevels(c)
    .map((x) => `${x.cls} ${x.level}`)
    .join(" / ");
}

export function sheetFor(c: Character) {
  const scores = characterScores(c);
  const fighter = c.classes.includes("Fighter");
  const sheet = deriveSheet({ race: c.race, classes: classLevels(c), scores, armour: c.play.armour, shield: c.play.shield, weapons: [], specialization: c.specialization });
  const ac = armourClass(c.classes, c.play.armour, c.play.shield, sheet.bonuses.ac);
  const rows = (list: WeaponRow[]): WeaponRowView[] =>
    list.map((row) => {
      if (!row.name) return { row, line: null };
      const line = weaponLine(row.name, sheet.attackBonus, sheet.bonuses, fighter ? c.specialization : null);
      return { row, line: { ...line, magic: row.magic, hitBonus: line.hitBonus + row.magic } };
    });
  const { fixed } = experienceSlotsFor(c.classes, c.race);
  // The CON column(s) the character's classes use, for the HP per hit die box.
  const conColumns = [...new Set(c.classes.map((cls) => (isWarrior(cls) ? sheet.bonuses.hpPerHitDieWarrior : sheet.bonuses.hpPerHitDie)))];
  const multi = c.classes.length > 1;
  return {
    scores,
    ...sheet,
    classLabel: classesLabel(c.classes),
    conColumns,
    ac: { ...ac, misc: c.play.acMisc, total: ac.total + c.play.acMisc },
    melee: rows(c.play.melee),
    ranged: rows(c.play.ranged),
    experiences: [...fixed, ...c.experiences],
    abilities: [
      ...sheet.classAbilities.map((a) => (multi ? `${a.cls}: ${a.text}` : a.text)),
      ...(multi ? c.classes.map((cls) => (multiclass.restrictions as Record<string, string>)[cls]).filter((t): t is string => Boolean(t)) : []),
    ],
  };
}

export type SheetView = ReturnType<typeof sheetFor>;

/** Most slots the class ever has at each spell level (the printed slot boxes), and how many it has now. */
export function slotTable(cls: ClassName, level: number): { spellLevel: number; max: number; now: number }[] {
  const all = classes[cls].spellSlots ?? [];
  const width = Math.max(0, ...all.map((r) => r.length));
  const now = spellSlots(cls, level);
  return Array.from({ length: width }, (_, i) => ({ spellLevel: i + 1, max: Math.max(0, ...all.map((r) => r[i] ?? 0)), now: now[i] ?? 0 }));
}

/** The Turn Undead column for a character, or null if they cannot turn yet. Paladins use the column two levels lower. */
export function turnUndeadColumn(cls: ClassName, level: number): number | null {
  if (cls !== "Cleric" && cls !== "Paladin") return null;
  const effective = cls === "Paladin" ? level - 2 : level;
  if (effective < 1) return null;
  const i = turnUndead.columns.findIndex((col) => {
    if (col.endsWith("+")) return effective >= Number(col.slice(0, -1));
    const [lo, hi] = col.split("-").map(Number);
    return effective >= lo! && effective <= (hi ?? lo!);
  });
  return i >= 0 ? i : null;
}
