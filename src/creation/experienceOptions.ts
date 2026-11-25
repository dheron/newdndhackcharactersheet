// What the Experiences step offers (Expanded Experiences doc, David): at first the DnD core skills,
// then the doc's Default Examples, then a few random picks from the full list. Randomize replaces
// the whole list with a random mix drawn evenly from Sections 1 to 4.
import { expandedExperiences } from "../rules";
import { defaultRng, type Rng } from "../engine/dice";

/** Extra random picks shown after the Default Examples when the step opens. */
export const EXTRA_EXAMPLES = 5;
/** Randomize draws this many from each section (the whole list is replaced, David). */
export const PER_SECTION = 9;

const norm = (s: string) => s.trim().toLowerCase();

/** Every entry in Sections 1 to 4, each once, with its section. */
export function experiencePool(): { name: string; section: number }[] {
  const seen = new Set<string>();
  const out: { name: string; section: number }[] = [];
  for (const s of expandedExperiences.sections)
    for (const g of s.groups)
      for (const name of g.items) {
        if (seen.has(norm(name))) continue;
        seen.add(norm(name));
        out.push({ name, section: s.number });
      }
  return out;
}

/** The core skills, minus Experiences the character already has. */
export function coreSkillOptions(have: string[]): string[] {
  const taken = new Set(have.map(norm));
  return expandedExperiences.coreSkills.filter((e) => !taken.has(norm(e)));
}

function shuffle<T>(list: T[], rng: Rng): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** Up to `count` random pool entries from one section, avoiding `exclude`. */
function draw(section: number | null, count: number, exclude: Set<string>, rng: Rng): string[] {
  const options = experiencePool().filter((e) => (section === null || e.section === section) && !exclude.has(norm(e.name)));
  return shuffle(options, rng)
    .slice(0, count)
    .map((e) => e.name);
}

/** The examples when the step opens: the Default Examples, then a few random entries from the full list. */
export function startingExamples(have: string[], rng: Rng = defaultRng): string[] {
  const exclude = new Set([...have, ...expandedExperiences.coreSkills].map(norm));
  const defaults = expandedExperiences.defaultExamples.filter((e) => !exclude.has(norm(e)));
  for (const e of defaults) exclude.add(norm(e));
  return [...defaults, ...draw(null, EXTRA_EXAMPLES, exclude, rng)];
}

/** Randomize: an even mix from every section (PER_SECTION each), shuffled together. */
export function randomExamples(have: string[], rng: Rng = defaultRng): string[] {
  const exclude = new Set([...have, ...expandedExperiences.coreSkills].map(norm));
  const picks: string[] = [];
  for (const s of expandedExperiences.sections) {
    const got = draw(s.number, PER_SECTION, exclude, rng);
    for (const e of got) exclude.add(norm(e));
    picks.push(...got);
  }
  return shuffle(picks, rng);
}
