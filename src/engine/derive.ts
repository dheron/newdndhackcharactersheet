// Works out every calculated value on the sheet from a character's choices.
// Formulas follow David's original app; values come from the rules data.
import {
  SAVE_KEYS,
  abilityValue,
  attackBonus,
  abilitiesUpTo,
  cantripsKnown,
  classes,
  decisions,
  hitDie,
  isWarrior,
  raceByName,
  saveTargets,
  spellSlots,
  wizardSpellsKnown,
  type ClassName,
  type SaveKey,
  type Stat,
} from "../rules";
import { armourByName, isRangedWeapon, weaponByName } from "./equipment";

/** One of a character's classes and its level. A multiclass character has two or three. */
export interface ClassLevel {
  cls: ClassName;
  level: number;
}

export interface DeriveInput {
  race: string;
  classes: ClassLevel[];
  scores: Record<Stat, number>;
  armour: string | null;
  shield: boolean;
  weapons: string[];
  /** Fighter Weapon Specialization (Classes v4): +2 damage to melee or ranged attacks. */
  specialization?: "melee" | "ranged" | null;
}

export interface StatBonuses {
  meleeHit: number;
  damage: number;
  rangedHit: number;
  ac: number;
  blastSave: number;
  /** CON HP per hit die, normal column. */
  hpPerHitDie: number;
  /** CON HP per hit die, warrior column (Fighter, Barbarian, Paladin, Ranger). */
  hpPerHitDieWarrior: number;
  languages: number;
  spellAttack: number;
  arcanePotency: number;
  divinePotency: number;
  mindSpellSave: number;
}

export interface WeaponLine {
  name: string;
  ranged: boolean;
  hitBonus: number;
  base: number;
  stat: number;
  magic: number;
  damage: string;
  type: string | null;
  range: string | null;
}

export interface SaveLine {
  /** The number the d20 roll must reach: base minus every always-on bonus. */
  total: number;
  base: number;
  /** Every always-on bonus (BNS): racial, plus DEX on Blast / Barrage. */
  bonus: number;
  /** Notes for bonuses that only apply sometimes. */
  notes: string[];
}

export function statBonuses(scores: Record<Stat, number>): StatBonuses {
  return {
    meleeHit: abilityValue("STR", "meleeHit", scores.STR),
    damage: abilityValue("STR", "damage", scores.STR),
    rangedHit: abilityValue("DEX", "rangedHit", scores.DEX),
    ac: abilityValue("DEX", "ac", scores.DEX),
    blastSave: abilityValue("DEX", "blastSave", scores.DEX),
    hpPerHitDie: abilityValue("CON", "hpPerHitDie", scores.CON),
    hpPerHitDieWarrior: abilityValue("CON", "hpPerHitDieWarrior", scores.CON),
    languages: abilityValue("INT", "languages", scores.INT),
    spellAttack: abilityValue("INT", "spellAttack", scores.INT),
    arcanePotency: abilityValue("INT", "arcanePotency", scores.INT),
    divinePotency: abilityValue("WIS", "divinePotency", scores.WIS),
    mindSpellSave: abilityValue("WIS", "mindSpellSave", scores.WIS),
  };
}

/** A class's CON bonus per hit die: warrior column for warriors, doubled for Barbarian. */
export function conHp(cls: ClassName, bonuses: StatBonuses): number {
  const value = isWarrior(cls) ? bonuses.hpPerHitDieWarrior : bonuses.hpPerHitDie;
  return cls === "Barbarian" ? value * 2 : value;
}

/**
 * Level 1 HP: maximum of the hit die plus the class's CON bonus.
 * Multiclass (David): the maximum of each class's hit die averaged, plus each class's CON bonus
 * averaged, each rounded down (Classes v4 splits the CON bonus between the classes). Never below 1.
 */
export function level1Hp(classes: ClassName[], bonuses: StatBonuses): number {
  const n = classes.length;
  const dice = Math.floor(classes.reduce((t, c) => t + hitDie(c), 0) / n);
  const con = Math.floor(classes.reduce((t, c) => t + conHp(c, bonuses), 0) / n);
  return Math.max(1, dice + con);
}

/**
 * AC: armour base + DEX AC bonus (up to the armour's cap; none for Heavy) + shield.
 * Barbarian with no armour: 10 + double DEX AC bonus.
 * No armour for other classes: 10 + DEX AC bonus. (Not in the docs; the original app used 10.)
 */
export function armourClass(classes: ClassName[], armourName: string | null, shield: boolean, dexAc: number): { total: number; base: number; dex: number; shield: number } {
  const shieldBonus = shield ? (armourByName("Shield").acBonus ?? 0) : 0;
  if (!armourName) {
    const dex = classes.includes("Barbarian") ? dexAc * 2 : dexAc;
    return { total: 10 + dex + shieldBonus, base: 10, dex, shield: shieldBonus };
  }
  const a = armourByName(armourName);
  if (a.baseAC === null) throw new Error(`${armourName} has no base AC`);
  const dex = a.dexCap === null ? dexAc : Math.min(dexAc, a.dexCap);
  return { total: a.baseAC + dex + shieldBonus, base: a.baseAC, dex, shield: shieldBonus };
}

export const SPECIALIZATION_DAMAGE = 2;

/** The best class Attack Bonus: multiclass characters use the most favourable (Classes v4). */
export function bestAttackBonus(classes: ClassLevel[]): number {
  return Math.max(...classes.map((c) => attackBonus(c.cls, c.level)));
}

export function weaponLine(name: string, base: number, bonuses: StatBonuses, specialization: "melee" | "ranged" | null = null): WeaponLine {
  const w = weaponByName(name);
  const ranged = isRangedWeapon(w);
  const stat = ranged ? bonuses.rangedHit : bonuses.meleeHit;
  const spec = specialization === (ranged ? "ranged" : "melee") ? SPECIALIZATION_DAMAGE : 0;
  const dmgBonus = (ranged ? 0 : bonuses.damage) + spec;
  const die = w.damage ?? "";
  const damage = dmgBonus === 0 ? die : `${die} ${dmgBonus > 0 ? "+" : "-"}${Math.abs(dmgBonus)}`;
  return { name, ranged, hitBonus: base + stat, base, stat, magic: 0, damage, type: w.type, range: w.range };
}

/** Saves: multiclass characters use the most favourable (lowest) target of their classes (Classes v4). */
export function saves(race: string, classes: ClassLevel[], bonuses: StatBonuses): Record<SaveKey, SaveLine> {
  const r = raceByName(race);
  const all = classes.map((c) => saveTargets(c.cls, c.level));
  const targets = Object.fromEntries(SAVE_KEYS.map((k) => [k, Math.min(...all.map((t) => t[k]))])) as Record<SaveKey, number>;
  const out = {} as Record<SaveKey, SaveLine>;
  for (const key of SAVE_KEYS) {
    const notes = r.situational.filter((s) => s.save === key).map((s) => s.text);
    if (key === "spell" && bonuses.mindSpellSave !== 0) notes.unshift(`WIS ${bonuses.mindSpellSave > 0 ? "+" : ""}${bonuses.mindSpellSave} vs mind`);
    // DEX always applies to Blast / Barrage (Saving Throws doc), so it is part of BNS.
    const bonus = (r.saveBonus[key] ?? 0) + (key === "blastBarrage" ? bonuses.blastSave : 0);
    out[key] = { total: targets[key] - bonus, base: targets[key], bonus, notes };
  }
  return out;
}

export interface Caster {
  cls: ClassName;
  level: number;
  spellAttack: number;
  /** The INT part of the Wizard spell attack (0 for other classes). */
  spellAttackStat: number;
  potency: number;
  potencyKind: "arcane" | "divine";
  slots: number[];
  cantrips: number;
  wizardKnown: number | null;
}

export function casterFor(c: ClassLevel, scores: Record<Stat, number>, bonuses: StatBonuses): Caster | null {
  const casting = decisions.spellcasting[c.cls as keyof typeof decisions.spellcasting];
  if (!casting) return null;
  const stat = casting.spellAttackStat === "INT" ? bonuses.spellAttack : 0;
  const base = c.cls === "Wizard" ? classes.Wizard.spellAttack![c.level - 1]! : attackBonus(c.cls, c.level);
  return {
    cls: c.cls,
    level: c.level,
    spellAttack: base + stat,
    spellAttackStat: stat,
    potency: casting.potency === "arcane" ? bonuses.arcanePotency : bonuses.divinePotency,
    potencyKind: casting.potency as "arcane" | "divine",
    slots: spellSlots(c.cls, c.level),
    cantrips: cantripsKnown(c.cls, c.level),
    wizardKnown: c.cls === "Wizard" ? wizardSpellsKnown(c.level, scores.INT) : null,
  };
}

export function deriveSheet(input: DeriveInput) {
  const bonuses = statBonuses(input.scores);
  const race = raceByName(input.race);
  const names = input.classes.map((c) => c.cls);
  const atk = bestAttackBonus(input.classes);
  const allLevel1 = input.classes.every((c) => c.level === 1);
  return {
    bonuses,
    /** The CON HP bonus columns this character uses, one per class. */
    conHp: names.map((cls) => conHp(cls, bonuses)),
    hpMax: allLevel1 ? level1Hp(names, bonuses) : null,
    hitDice: input.classes.map((c) => ({ cls: c.cls, dice: classes[c.cls].hp[c.level - 1]! })),
    attackBonus: atk,
    move: race.move,
    ac: armourClass(names, input.armour, input.shield, bonuses.ac),
    weapons: input.weapons.map((w) => weaponLine(w, atk, bonuses, names.includes("Fighter") ? (input.specialization ?? null) : null)),
    saves: saves(input.race, input.classes, bonuses),
    generalSaveNotes: race.situational.filter((s) => s.save === null).map((s) => s.text),
    classAbilities: input.classes.flatMap((c) => abilitiesUpTo(c.cls, c.level).map((a) => ({ cls: c.cls, text: a.text }))),
    raceTraits: race.traits,
    casters: input.classes.map((c) => casterFor(c, input.scores, bonuses)).filter((c): c is Caster => c !== null),
  };
}
