// Turns each Starting Equipment option (Weapons and Armour sheet) into concrete choices.
// The table is keyed by the exact option text, so a change in the sheet makes the
// "every option is mapped" test fail until this file is updated.
import { armour, decisions, startingOptions, weapons, type Armour, type ClassName, type Weapon } from "../rules";

/**
 * Interpretations (listed in docs/rules-report.md):
 * - Melee means any weapon that is not a bow, crossbow, sling or dart.
 * - One-Handed means without the Two-Handed trait.
 * - Names in the options are matched to the tables: "Learther Armour" = Leather, "Light Cross" = Light Crossbow,
 *   "Longsword" = Long Sword, "Shortsword" = Short Sword, "Shortbow" = Short Bow.
 * - Ranger's "One-Handed Martial" is melee only (David).
 * - Druid and Wizard weapons are the class weapon lists in Classes v4.
 */
const RANGED_ONLY = new Set(["Short Bow", "Light Crossbow", "Sling", "Dart", "Long Bow", "Hand Crossbow", "Heavy Crossbow"]);
const DRUID_WEAPONS = ["Club", "Dagger", "Dart", "Javelin", "Mace", "Quarterstaff", "Scimitar", "Sickle", "Sling", "Spear"];
const WIZARD_WEAPONS = ["Dagger", "Dart", "Sling", "Quarterstaff", "Sickle", "Light Crossbow"];

/** Bows, crossbows, slings and darts attack with DEX; everything else, including thrown weapons, with STR. */
export const isRangedWeapon = (w: Weapon) => RANGED_ONLY.has(w.name);
const isMelee = (w: Weapon) => !isRangedWeapon(w);
const isTwoHanded = (w: Weapon) => w.traits.includes("Two-Handed");

export const WEAPON_FILTERS = {
  twoHandedMartialMelee: { label: "Two-Handed Martial Melee weapon", test: (w: Weapon) => w.category === "Martial" && isMelee(w) && isTwoHanded(w) },
  oneHandedMartialMelee: { label: "One-Handed Martial Melee weapon", test: (w: Weapon) => w.category === "Martial" && isMelee(w) && !isTwoHanded(w) },
  martialMelee: { label: "Martial Melee weapon", test: (w: Weapon) => w.category === "Martial" && isMelee(w) },
  thrown: { label: "thrown weapon", test: (w: Weapon) => w.traits.includes("Thrown") },
  lightOrThrown: { label: "light or thrown weapon", test: (w: Weapon) => w.traits.includes("Light") || w.traits.includes("Thrown") },
  druidWeapon: { label: "Druid weapon", test: (w: Weapon) => DRUID_WEAPONS.includes(w.name) },
  wizardWeapon: { label: "Wizard weapon", test: (w: Weapon) => WIZARD_WEAPONS.includes(w.name) },
} as const;
export type WeaponFilter = keyof typeof WEAPON_FILTERS;

export type Slot =
  | { kind: "pick"; filter: WeaponFilter; count: number }
  | { kind: "weapon"; name: string; count: number }
  | { kind: "armour"; options: string[] }
  | { kind: "shield" };

const pick = (filter: WeaponFilter, count = 1): Slot => ({ kind: "pick", filter, count });
const weapon = (name: string, count = 1): Slot => ({ kind: "weapon", name, count });
const wear = (...options: string[]): Slot => ({ kind: "armour", options });
const shield: Slot = { kind: "shield" };

export const OPTION_SLOTS: Record<string, Slot[]> = {
  "Two-Handed Martial Melee": [pick("twoHandedMartialMelee")],
  "One-Handed Martial Melee and Light Crossbow": [pick("oneHandedMartialMelee"), weapon("Light Crossbow")],
  "Two One-Handed Martial Melee and one thrown weapon": [pick("oneHandedMartialMelee", 2), pick("thrown")],
  "Chain Mail": [wear("Chain Mail")],
  "Chain Shirt and Shield": [wear("Chain Shirt"), shield],
  "Leather and Long Bow": [wear("Leather"), weapon("Long Bow")],
  "Scale Mail / Brigandine / Chain Shirt and One-Handed Martial": [wear("Scale Mail", "Brigandine", "Chain Shirt"), pick("oneHandedMartialMelee")],
  "Learther Armour and Long Bow": [wear("Leather"), weapon("Long Bow")],
  "One Handed Martial Melee and Shield": [pick("oneHandedMartialMelee"), shield],
  "Shortbow and Dagger": [weapon("Short Bow"), weapon("Dagger")],
  "One Handed Martial Melee and Short Sword": [pick("oneHandedMartialMelee"), weapon("Short Sword")],
  Shield: [shield],
  "Any light or thrown weapon": [pick("lightOrThrown")],
  "Scale Mail and Shield": [wear("Scale Mail"), shield],
  "Leather Armour and any Druid weapon": [wear("Leather"), pick("druidWeapon")],
  "Hide Armour and any Druid weapon": [wear("Hide"), pick("druidWeapon")],
  "Any Druid Weapon": [pick("druidWeapon")],
  "Studded Leather": [wear("Studded Leather")],
  "Leather Armour and Rapier": [wear("Leather"), weapon("Rapier")],
  "Light Cross and 2 Dagger": [weapon("Light Crossbow"), weapon("Dagger", 2)],
  "Longsword and Shortsword": [weapon("Long Sword"), weapon("Short Sword")],
  "Chain Shirt and One Handed Martial Melee": [wear("Chain Shirt"), pick("oneHandedMartialMelee")],
  "Heavy Crossbow and Dagger": [weapon("Heavy Crossbow"), weapon("Dagger")],
  "Any two Martial Melee weapons": [pick("martialMelee", 2)],
  "Any two Wizard Weapons": [pick("wizardWeapon", 2)],
};

export function slotsFor(option: string): Slot[] {
  const slots = OPTION_SLOTS[option.trim()];
  if (!slots) throw new Error(`No mapping for starting equipment option "${option}"`);
  return slots;
}

export function optionsFor(cls: ClassName): { choiceOne: string[]; choiceTwo: string[] } {
  const o = startingOptions[cls];
  return { choiceOne: o.choiceOne.map((s) => s.trim()), choiceTwo: o.choiceTwo.map((s) => s.trim()) };
}

export function weaponsFor(filter: WeaponFilter): Weapon[] {
  return weapons.filter(WEAPON_FILTERS[filter].test);
}

export function weaponByName(name: string): Weapon {
  const w = weapons.find((x) => x.name === name);
  if (!w) throw new Error(`Unknown weapon ${name}`);
  return w;
}

export function armourByName(name: string): Armour {
  const a = armour.find((x) => x.name === name);
  if (!a) throw new Error(`Unknown armour ${name}`);
  return a;
}

/** Armour the character is strong enough for (Str Req enforced during creation, David's decision). */
export function meetsStrength(armourName: string, str: number): boolean {
  const req = armourByName(armourName).strReq;
  return req === null || str >= req;
}

/** True when every armour slot in the option has at least one wearable choice. */
/** Armour in a starting option the character can take: strong enough (creation rule) and allowed for their classes. */
export function armourChoosable(name: string, str: number, classes: ClassName[]): boolean {
  return meetsStrength(name, str) && (classes.length === 0 || canWear(classes, name));
}

export function optionAvailable(option: string, str: number, classes: ClassName[] = []): boolean {
  return slotsFor(option).every((s) => {
    if (s.kind === "armour") return s.options.some((name) => armourChoosable(name, str, classes));
    if (s.kind === "shield") return classes.length === 0 || canWear(classes, "Shield");
    return true;
  });
}

// Armour each class may wear, and multiclass restrictions (decisions.json, from Classes v4).
type ArmourAllowance = { groups?: string[]; names?: string[]; shield: boolean };
const ALLOWED = decisions.classArmour.allowed as Record<ClassName, ArmourAllowance>;

function classAllows(cls: ClassName, a: Armour): boolean {
  const rule = ALLOWED[cls];
  if (a.group === "Shield") return rule.shield;
  return (rule.groups ?? []).includes(a.group) || (rule.names ?? []).includes(a.name);
}

/**
 * Whether a character of these classes may wear this armour (or Shield): any of their classes
 * must allow it, and a Druid, single or multiclassed, never wears metal armour.
 */
export function canWear(classes: ClassName[], armourName: string): boolean {
  const a = armourByName(armourName);
  if (!classes.some((c) => classAllows(c, a))) return false;
  if (classes.includes("Druid") && !classAllows("Druid", a)) return false;
  return true;
}

/** Why the armour cannot be worn, for the UI; null if it can. */
export function cannotWearReason(classes: ClassName[], armourName: string): string | null {
  if (canWear(classes, armourName)) return null;
  const a = armourByName(armourName);
  if (classes.includes("Druid") && classes.some((c) => classAllows(c, a))) return "Druids may only wear non-metal armour";
  return `Not allowed for ${classes.join(" / ")}`;
}

export interface Restriction {
  cls: ClassName;
  /** "all" class abilities, or the names of the abilities switched off. */
  abilities: string[] | "all";
  spellcasting: boolean;
  reason: string;
}

type RestrictionRule = { abilities: string[] | "all"; spellcasting: boolean; offIn: string[] };
const RESTRICTIONS = decisions.multiclassRestrictions.classes as Partial<Record<ClassName, RestrictionRule>>;

/** Multiclass restrictions in force while wearing this armour (none for single-class characters). */
export function restrictionsFor(classes: ClassName[], armourName: string | null): Restriction[] {
  if (classes.length < 2 || !armourName) return [];
  const a = armourByName(armourName);
  return classes.flatMap((cls) => {
    const rule = RESTRICTIONS[cls];
    if (!rule || !rule.offIn.includes(a.group)) return [];
    return [{ cls, abilities: rule.abilities, spellcasting: rule.spellcasting, reason: `not while wearing ${a.group.toLowerCase()} armour (multiclassed ${cls})` }];
  });
}

// Weapons each class may use (Classes v4, decisions.json classWeapons).
const THIEF_EXTRA = decisions.classWeapons.thiefExtra;
const ELF_EXTRA = decisions.classWeapons.elfExtra;

export function classAllowsWeapon(cls: ClassName, w: Weapon): boolean {
  if (cls === "Druid") return DRUID_WEAPONS.includes(w.name);
  if (cls === "Wizard") return WIZARD_WEAPONS.includes(w.name);
  if (cls === "Thief") return w.category === "Simple" || THIEF_EXTRA.includes(w.name);
  return true;
}

/** A warning when none of the character's classes (nor an Elf's race) allows the weapon, else null. */
export function weaponWarning(classes: ClassName[], race: string, name: string): string | null {
  const w = weaponByName(name);
  if (classes.some((c) => classAllowsWeapon(c, w))) return null;
  if (race.startsWith("Elf") && ELF_EXTRA.includes(w.name)) return null;
  return `Not a ${classes.join(" / ")} weapon`;
}
