// Multiclass combinations by race, read from the Classes v4 Multiclassing table.
// A class marked with stars can be swapped for the class the race's key names for that
// many stars ("Fighter*/Thief**" with "*or Ranger **or Bard" also allows Ranger/Thief,
// Fighter/Bard and Ranger/Bard).
import { CLASS_NAMES, multiclass, type ClassName } from "../rules";

/** The table says "Mage" for some races; this system's class is Wizard. */
const NAME_FIXES: Record<string, ClassName> = { Mage: "Wizard" };

function className(raw: string): ClassName {
  const name = NAME_FIXES[raw] ?? raw;
  if (!(CLASS_NAMES as readonly string[]).includes(name)) throw new Error(`Unknown class in multiclass table: ${raw}`);
  return name as ClassName;
}

/** "*or Ranger **or Bard. ***or Druid" -> { 1: "Ranger", 2: "Bard", 3: "Druid" } */
export function parseKey(key: string): Record<number, ClassName> {
  const out: Record<number, ClassName> = {};
  for (const m of key.matchAll(/(\*+)\s*or\s+([A-Za-z]+)/g)) out[m[1]!.length] = className(m[2]!);
  return out;
}

/** Every class combination a race can take, in table order, each as a list of classes. */
export function multiclassOptions(race: string): ClassName[][] {
  const entry = (multiclass.combinations as Record<string, { options: string; key: string }>)[race];
  if (!entry) return [];
  const swaps = parseKey(entry.key);
  const seen = new Set<string>();
  const out: ClassName[][] = [];
  for (const option of entry.options.replace(/\.\s*$/, "").split(",")) {
    const parts = option
      .trim()
      .split("/")
      .map((p) => {
        const m = /^([A-Za-z]+)(\**)$/.exec(p.trim());
        if (!m) throw new Error(`Cannot read multiclass option "${option.trim()}" for ${race}`);
        const base = className(m[1]!);
        const alt = m[2] ? swaps[m[2].length] : undefined;
        return alt ? [base, alt] : [base];
      });
    let combos: ClassName[][] = [[]];
    for (const choices of parts) combos = combos.flatMap((c) => choices.map((x) => [...c, x]));
    for (const combo of combos) {
      if (new Set(combo).size !== combo.length) continue;
      const id = combo.join("/");
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(combo);
    }
  }
  return out;
}

export const classesLabel = (classes: readonly ClassName[]) => classes.join(" / ");
