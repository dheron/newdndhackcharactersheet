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

export interface DeriveInput {
  race: string;
  cls: ClassName;
  level: number;
  scores: Record<Stat, number>;
  armour: string | null;
  shield: boolean;
  weapons: string[];
}

export interface StatBonuses {
  meleeHit: number;
  damage: number;
  rangedHit: number;
  ac: number;
  blastSave: number;
  hpPerHitDie: number;
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
  base: number;
  /** Always-on racial bonus (BNS). */
  bonus: number;
  /** Notes for bonuses that only apply sometimes. */
  notes: string[];
}

export function statBonuses(scores: Record<Stat, number>, cls: ClassName): StatBonuses {
  return {
    meleeHit: abilityValue("STR", "meleeHit", scores.STR),
    damage: abilityValue("STR", "damage", scores.STR),
    rangedHit: abilityValue("DEX", "rangedHit", scores.DEX),
    ac: abilityValue("DEX", "ac", scores.DEX),
    blastSave: abilityValue("DEX", "blastSave", scores.DEX),
    hpPerHitDie: abilityValue("CON", isWarrior(cls) ? "hpPerHitDieWarrior" : "hpPerHitDie", scores.CON),
    languages: abilityValue("INT", "languages", scores.INT),
    spellAttack: abilityValue("INT", "spellAttack", scores.INT),
    arcanePotency: abilityValue("INT", "arcanePotency", scores.INT),
    divinePotency: abilityValue("WIS", "divinePotency", scores.WIS),
    mindSpellSave: abilityValue("WIS", "mindSpellSave", scores.WIS),
  };
}

/** Level 1 HP: maximum of the hit die plus the CON bonus; Barbarian doubles the CON bonus. */
export function level1Hp(cls: ClassName, bonuses: StatBonuses): number {
  const con = cls === "Barbarian" ? bonuses.hpPerHitDie * 2 : bonuses.hpPerHitDie;
  return hitDie(cls) + con;
}

/**
 * AC: armour base + DEX AC bonus (up to the armour's cap; none for Heavy) + shield.
 * Barbarian with no armour: 10 + double DEX AC bonus.
 * No armour for other classes: 10 + DEX AC bonus. (Not in the docs; the original app used 10.)
 */
export function armourClass(cls: ClassName, armourName: string | null, shield: boolean, dexAc: number): { total: number; base: number; dex: number; shield: number } {
  const shieldBonus = shield ? (armourByName("Shield").acBonus ?? 0) : 0;
  if (!armourName) {
    const dex = cls === "Barbarian" ? dexAc * 2 : dexAc;
    return { total: 10 + dex + shieldBonus, base: 10, dex, shield: shieldBonus };
  }
  const a = armourByName(armourName);
  if (a.baseAC === null) throw new Error(`${armourName} has no base AC`);
  const dex = a.dexCap === null ? dexAc : Math.min(dexAc, a.dexCap);
  return { total: a.baseAC + dex + shieldBonus, base: a.baseAC, dex, shield: shieldBonus };
}

export function weaponLine(name: string, cls: ClassName, level: number, bonuses: StatBonuses): WeaponLine {
  const w = weaponByName(name);
  const ranged = isRangedWeapon(w);
  const base = attackBonus(cls, level);
  const stat = ranged ? bonuses.rangedHit : bonuses.meleeHit;
  const dmgBonus = ranged ? 0 : bonuses.damage;
  const die = w.damage ?? "";
  const damage = dmgBonus === 0 ? die : `${die} ${dmgBonus > 0 ? "+" : "-"}${Math.abs(dmgBonus)}`;
  return { name, ranged, hitBonus: base + stat, base, stat, magic: 0, damage, type: w.type, range: w.range };
}

export function saves(race: string, cls: ClassName, level: number, bonuses: StatBonuses): Record<SaveKey, SaveLine> {
  const r = raceByName(race);
  const targets = saveTargets(cls, level);
  const out = {} as Record<SaveKey, SaveLine>;
  for (const key of SAVE_KEYS) {
    const notes = r.situational.filter((s) => s.save === key).map((s) => s.text);
    if (key === "blastBarrage" && bonuses.blastSave !== 0) notes.unshift(`DEX ${bonuses.blastSave > 0 ? "+" : ""}${bonuses.blastSave}`);
    if (key === "spell" && bonuses.mindSpellSave !== 0) notes.unshift(`WIS ${bonuses.mindSpellSave > 0 ? "+" : ""}${bonuses.mindSpellSave} vs mind`);
    out[key] = { base: targets[key], bonus: r.saveBonus[key] ?? 0, notes };
  }
  return out;
}

export function deriveSheet(input: DeriveInput) {
  const bonuses = statBonuses(input.scores, input.cls);
  const race = raceByName(input.race);
  const casting = decisions.spellcasting[input.cls];
  const c = classes[input.cls];
  return {
    bonuses,
    hpMax: input.level === 1 ? level1Hp(input.cls, bonuses) : null,
    hitDice: c.hp[input.level - 1]!,
    attackBonus: attackBonus(input.cls, input.level),
    ac: armourClass(input.cls, input.armour, input.shield, bonuses.ac),
    weapons: input.weapons.map((w) => weaponLine(w, input.cls, input.level, bonuses)),
    saves: saves(input.race, input.cls, input.level, bonuses),
    generalSaveNotes: race.situational.filter((s) => s.save === null).map((s) => s.text),
    classAbilities: abilitiesUpTo(input.cls, input.level).map((a) => a.text),
    raceTraits: race.traits,
    spellcasting: casting
      ? {
          spellAttack: (input.cls === "Wizard" ? c.spellAttack![input.level - 1]! : attackBonus(input.cls, input.level)) + (casting.spellAttackStat === "INT" ? bonuses.spellAttack : 0),
          potency: casting.potency === "arcane" ? bonuses.arcanePotency : bonuses.divinePotency,
          potencyKind: casting.potency,
          slots: spellSlots(input.cls, input.level),
          cantrips: cantripsKnown(input.cls, input.level),
          wizardKnown: input.cls === "Wizard" ? wizardSpellsKnown(input.level, input.scores.INT) : null,
        }
      : null,
  };
}
