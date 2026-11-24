// Everything the sheet shows that is worked out from the saved character and the rules data.
import { classes, decisions, isWarrior, raceByName, spellSlots, turnUndead, type ClassName, type Stat } from "../rules";
import { finalScores, racialModifiers } from "../engine/abilities";
import { armourClass, deriveSheet, level1Hp, weaponLine, type ClassLevel } from "../engine/derive";
import { totalHp } from "../engine/levels";
import { classesLabel } from "../engine/multiclass";
import { experienceSlotsFor } from "../creation/draft";
import { parseItem, rolledScores, type Character, type WeaponRow } from "../model/character";
import { armour as armourList, weapons as weaponList } from "../rules";
import { cannotWearReason, isRangedWeapon, restrictionsFor, weaponWarning, type Restriction } from "../engine/equipment";

export type ItemKind = "armour" | "shield" | "melee" | "ranged";

const lower = (s: string) => s.trim().toLowerCase();

/** What an inventory line is, if it is something the character can equip. */
export function equippable(line: string): { kind: ItemKind; name: string } | null {
  const { name } = parseItem(line);
  const a = armourList.find((x) => lower(x.name) === lower(name) && (x.baseAC !== null || x.group === "Shield"));
  if (a) return { kind: a.group === "Shield" ? "shield" : "armour", name: a.name };
  const w = weaponList.find((x) => lower(x.name) === lower(name));
  if (w) return { kind: isRangedWeapon(w) ? "ranged" : "melee", name: w.name };
  return null;
}

export function isEquipped(c: Character, item: { kind: ItemKind; name: string }): boolean {
  if (item.kind === "armour") return c.play.armour === item.name;
  if (item.kind === "shield") return c.play.shield;
  return (item.kind === "melee" ? c.play.melee : c.play.ranged).some((r) => r.name === item.name);
}

/** Equip or unequip an inventory item. Equipping a weapon uses the first empty row of its kind. */
export function toggleEquip(c: Character, item: { kind: ItemKind; name: string }): Character {
  const play = { ...c.play };
  const on = isEquipped(c, item);
  if (item.kind === "armour") play.armour = on ? null : item.name;
  else if (item.kind === "shield") play.shield = !on;
  else {
    const key = item.kind;
    const rows = play[key].map((r) => ({ ...r }));
    if (on) {
      const i = rows.findIndex((r) => r.name === item.name);
      rows[i] = { name: "", magic: 0, note: "" };
    } else {
      const i = rows.findIndex((r) => !r.name);
      if (i < 0) return c;
      rows[i] = { name: item.name, magic: 0, note: "" };
    }
    play[key] = rows;
  }
  return { ...c, play };
}

/** Why an item cannot be equipped right now, or null. */
export function equipBlocked(c: Character, item: { kind: ItemKind; name: string }): string | null {
  if (isEquipped(c, item)) return null;
  // Armour the classes do not allow can still be equipped; the AC note warns (David).
  if (item.kind === "armour" || item.kind === "shield") return null;
  const rows = item.kind === "melee" ? c.play.melee : c.play.ranged;
  return rows.some((r) => !r.name) ? null : `No free ${item.kind} weapon row`;
}

/** Inventory items of a kind, for the armour and weapon dropdowns (each name once). */
export function inventoryOf(c: Character, kind: ItemKind): string[] {
  const names = c.play.inventory.map(equippable).filter((x): x is { kind: ItemKind; name: string } => x !== null && x.kind === kind).map((x) => x.name);
  return [...new Set(names)];
}

function abilityOff(restrictions: Restriction[], cls: ClassName, text: string): string | null {
  const r = restrictions.find((x) => x.cls === cls && (x.abilities === "all" || x.abilities.some((name) => text.startsWith(name))));
  return r ? r.reason : null;
}

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
  /** Set when none of the character's classes may use this weapon. */
  warning: string | null;
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

const RULES = new Set<string>(decisions.notOnAbilityList.rules);
const LANGUAGES = new Set<string>(decisions.notOnAbilityList.languages);

/** Class abilities and race traits that are rules or languages are left off the Abilities list (David). */
export function isAbility(text: string): boolean {
  return !RULES.has(text) && !LANGUAGES.has(text);
}

/** Every Experience the character has: from class and race, chosen at creation, and written in since. */
export function allExperiences(c: Character): string[] {
  return [...experienceSlotsFor(c.classes, c.race).fixed, ...c.experiences, ...c.play.extraExperiences.filter((e) => e.trim() !== "")];
}

const UPGRADES = decisions.abilityUpgrades;
const groupOf = (text: string, prefixes: string[]) => prefixes.find((p) => text.startsWith(p)) ?? null;

/**
 * A class's abilities as they stand now: an improved ability replaces its older line, a repeated
 * one is counted ("Extra Attack (x2)"), and some are shown once (decisions.json, abilityUpgrades).
 */
export function currentAbilities(list: { cls: ClassName; text: string }[]): { cls: ClassName; text: string }[] {
  const out: { cls: ClassName; text: string; key: string | null; count: number }[] = [];
  for (const a of list) {
    const replace = groupOf(a.text, UPGRADES.replace);
    const count = groupOf(a.text, UPGRADES.count);
    const once = groupOf(a.text, UPGRADES.once);
    const key = replace ?? count ?? once;
    const existing = key ? out.find((o) => o.cls === a.cls && o.key === key) : undefined;
    if (!existing) out.push({ ...a, key, count: 1 });
    else if (replace) existing.text = a.text;
    else if (count) existing.count += 1;
  }
  return out.map((o) => ({ cls: o.cls, text: o.count > 1 ? `${o.text} (x${o.count})` : o.text }));
}

/** Abilities that ask the player to write a choice next to them (Natural Explorer: "Pick terrain"). */
export const takesNote = (abilityText: string) => abilityText.startsWith("Natural Explorer");

export function sheetFor(c: Character) {
  const scores = characterScores(c);
  const fighter = c.classes.includes("Fighter");
  const sheet = deriveSheet({ race: c.race, classes: classLevels(c), scores, armour: c.play.armour, shield: c.play.shield, weapons: [], specialization: c.specialization });
  const ac = armourClass(c.classes, c.play.armour, c.play.shield, sheet.bonuses.ac);
  const rows = (list: WeaponRow[]): WeaponRowView[] =>
    list.map((row) => {
      if (!row.name) return { row, line: null, warning: null };
      const line = weaponLine(row.name, sheet.attackBonus, sheet.bonuses, fighter ? c.specialization : null);
      return { row, line: { ...line, magic: row.magic, hitBonus: line.hitBonus + row.magic }, warning: weaponWarning(c.classes, c.race, row.name) };
    });
  const { fixed } = experienceSlotsFor(c.classes, c.race);
  // The CON column(s) the character's classes use, for the HP per hit die box.
  const conColumns = [...new Set(c.classes.map((cls) => (isWarrior(cls) ? sheet.bonuses.hpPerHitDieWarrior : sheet.bonuses.hpPerHitDie)))];
  const multi = c.classes.length > 1;
  const restrictions = restrictionsFor(c.classes, c.play.armour);
  return {
    scores,
    ...sheet,
    hpMax: totalHp(level1Hp(c.classes, sheet.bonuses), c),
    classLabel: classesLabel(c.classes),
    conColumns,
    ac: { ...ac, misc: c.play.acMisc, total: ac.total + c.play.acMisc },
    melee: rows(c.play.melee),
    ranged: rows(c.play.ranged),
    experiences: [...fixed, ...c.experiences],
    abilities: [
      ...currentAbilities(sheet.classAbilities).filter((a) => isAbility(a.text)).map((a) => ({ raw: a.text, text: multi ? `${a.cls}: ${a.text}` : a.text, off: abilityOff(restrictions, a.cls, a.text) })),
      ...sheet.raceTraits.filter(isAbility).map((text) => ({ raw: text, text, off: null as string | null })),
    ],
    /** Short warnings for the AC row's Note box: what the worn armour switches off (multiclass restrictions). */
    armourWarnings: [
      ...[c.play.armour, c.play.shield ? "Shield" : null].flatMap((name) => {
        const why = name ? cannotWearReason(c.classes, name) : null;
        return why ? [`${name}: ${why}`] : [];
      }),
      ...restrictions.map((r) => `${r.cls}: no ${r.abilities === "all" ? "class abilities" : [...r.abilities, ...(r.spellcasting ? ["spellcasting"] : [])].join(", ")}`),
    ],
    /** Spellcasting switched off by armour, per class, with the reason. */
    castingOff: Object.fromEntries(restrictions.filter((r) => r.spellcasting).map((r) => [r.cls, r.reason])) as Partial<Record<ClassName, string>>,
    /** Languages that come from class abilities (Thieves' Cant). */
    languages: sheet.classAbilities.map((a) => a.text).filter((t) => LANGUAGES.has(t)),
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
