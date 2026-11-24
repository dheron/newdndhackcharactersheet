// Dice rolling with an injectable random source so tests are repeatable.

/** Returns a number in [0, 1), like Math.random. */
export type Rng = () => number;

export const defaultRng: Rng = Math.random;

export function rollDie(sides: number, rng: Rng = defaultRng): number {
  return Math.floor(rng() * sides) + 1;
}

export function rollDice(count: number, sides: number, rng: Rng = defaultRng): number[] {
  return Array.from({ length: count }, () => rollDie(sides, rng));
}

/** Parses "2d6" style dice. */
export function parseDice(text: string): { count: number; sides: number } {
  const match = /^(\d+)d(\d+)$/.exec(text.trim());
  if (!match) throw new Error(`Not a dice expression: ${text}`);
  return { count: Number(match[1]), sides: Number(match[2]) };
}

export function rollTotal(text: string, rng: Rng = defaultRng): { rolls: number[]; total: number } {
  const { count, sides } = parseDice(text);
  const rolls = rollDice(count, sides, rng);
  return { rolls, total: rolls.reduce((a, b) => a + b, 0) };
}

/** A repeatable random source for tests and previews (mulberry32). */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A random source that returns fixed die faces in order, for tests. */
export function fixedRng(faces: number[], sides: number): Rng {
  let i = 0;
  return () => {
    const face = faces[i++ % faces.length]!;
    return (face - 1) / sides;
  };
}
