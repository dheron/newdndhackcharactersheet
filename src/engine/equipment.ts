// Turns each Starting Equipment option (Weapons and Armour sheet) into concrete choices.
// The table is keyed by the exact option text, so a change in the sheet makes the
// "every option is mapped" test fail until this file is updated.
import { armour, startingOptions, weapons, type Armour, type ClassName, type Weapon } from "../rules";

/**
 * Interpretations (listed in docs/rules-report.md):
 * - Melee means any weapon that is not a bow, crossbow, sling or dart.
 * - One-Handed means without the Two-Handed trait.
 * - Names in the options are matched to the tables: "Chain Mail" = Chain / Banded Mail,
 *   "Scale Mail" = Scale Mail / Brigandine, "Learther Armour" = Leather, "Light Cross" = Light Crossbow,
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
  "Chain Mail": [wear("Chain / Banded Mail")],
  "Chain Shirt and Shield": [wear("Chain Shirt"), shield],
  "Leather and Long Bow": [wear("Leather"), weapon("Long Bow")],
  "Scale Mail / Brigandine / Chain Shirt and One-Handed Martial": [wear("Scale Mail / Brigandine", "Chain Shirt"), pick("oneHandedMartialMelee")],
  "Learther Armour and Long Bow": [wear("Leather"), weapon("Long Bow")],
  "One Handed Martial Melee and Shield": [pick("oneHandedMartialMelee"), shield],
  "Shortbow and Dagger": [weapon("Short Bow"), weapon("Dagger")],
  "One Handed Martial Melee and Short Sword": [pick("oneHandedMartialMelee"), weapon("Short Sword")],
  Shield: [shield],
  "Any light or thrown weapon": [pick("lightOrThrown")],
  "Scale Mail and Shield": [wear("Scale Mail / Brigandine"), shield],
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
export function optionAvailable(option: string, str: number): boolean {
  return slotsFor(option).every((s) => s.kind !== "armour" || s.options.some((name) => meetsStrength(name, str)));
}
