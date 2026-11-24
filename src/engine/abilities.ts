// Ability score generation, as in David's original app (legacy/dnd-character-generator.html):
// the player picks a stat, then rolls for it. The dice depend on pick order.
// Racial modifiers apply after rolling, then each score is held to 6 to 18.
import { STATS, type RaceRules, type Stat } from "../rules";
import { defaultRng, rollDice, type Rng } from "./dice";

export const SCORE_MIN = 6;
export const SCORE_MAX = 18;

export type RollMethod =
  | { kind: "keepHighest"; dice: number; keep: 3; label: string }
  | { kind: "bestOfTwo"; dice: 2; label: string };

/** Index 0 is the first stat picked. */
export const ROLL_METHODS: RollMethod[] = [
  { kind: "keepHighest", dice: 7, keep: 3, label: "7d6 keep top 3" },
  { kind: "keepHighest", dice: 6, keep: 3, label: "6d6 keep top 3" },
  { kind: "keepHighest", dice: 5, keep: 3, label: "5d6 keep top 3" },
  { kind: "keepHighest", dice: 4, keep: 3, label: "4d6 keep top 3" },
  { kind: "keepHighest", dice: 3, keep: 3, label: "3d6" },
  { kind: "bestOfTwo", dice: 2, label: "2d6 twice, keep the higher total" },
];

export interface StatRoll {
  stat: Stat;
  pick: number;
  method: string;
  /** Every die rolled. For best of two, the first attempt then the second. */
  dice: number[];
  /** Dice that count toward the total. */
  kept: number[];
  total: number;
}

export function rollForPick(stat: Stat, pick: number, rng: Rng = defaultRng): StatRoll {
  const method = ROLL_METHODS[pick];
  if (!method) throw new RangeError(`Pick must be 0 to 5, got ${pick}`);
  if (method.kind === "keepHighest") {
    const dice = rollDice(method.dice, 6, rng);
    const kept = [...dice].sort((a, b) => b - a).slice(0, method.keep);
    return { stat, pick, method: method.label, dice, kept, total: kept.reduce((a, b) => a + b, 0) };
  }
  const first = rollDice(2, 6, rng);
  const second = rollDice(2, 6, rng);
  const sum = (d: number[]) => d.reduce((a, b) => a + b, 0);
  const kept = sum(first) >= sum(second) ? first : second;
  return { stat, pick, method: method.label, dice: [...first, ...second], kept, total: sum(kept) };
}

/** Exact expected roll for each pick (enumerated, not simulated). */
export const EXPECTED_ROLL: number[] = ROLL_METHODS.map((m) => expectedFor(m));

function expectedFor(method: RollMethod): number {
  const dist = rollDistribution(method);
  return dist.reduce((sum, p, total) => sum + p * total, 0);
}

/** Probability of each total (index = total) for a roll method. */
export function rollDistribution(method: RollMethod): number[] {
  const counts = new Array<number>(19).fill(0);
  let outcomes = 0;
  const visit = (n: number, acc: number[]) => {
    if (n === 0) {
      outcomes++;
      if (method.kind === "keepHighest") {
        const total = [...acc].sort((a, b) => b - a).slice(0, 3).reduce((a, b) => a + b, 0);
        counts[total]!++;
      } else {
        counts[Math.max(acc[0]! + acc[1]!, acc[2]! + acc[3]!)]!++;
      }
      return;
    }
    for (let face = 1; face <= 6; face++) visit(n - 1, [...acc, face]);
  };
  visit(method.kind === "keepHighest" ? method.dice : 4, []);
  return counts.map((c) => c / outcomes);
}

/** Chance that a racial bonus is partly lost to the 18 cap for this pick. */
export function capWasteChance(pick: number, bonus: number): number {
  if (bonus <= 0) return 0;
  const method = ROLL_METHODS[pick];
  if (!method) throw new RangeError(`Pick must be 0 to 5, got ${pick}`);
  return rollDistribution(method).reduce((sum, p, total) => (total + bonus > SCORE_MAX ? sum + p : sum), 0);
}

/** Racial modifiers for a race, including the two +1 picks for choose-two races. */
export function racialModifiers(race: RaceRules, chosen: Stat[] = []): Record<Stat, number> {
  const mods = Object.fromEntries(STATS.map((s) => [s, race.modifiers[s] ?? 0])) as Record<Stat, number>;
  if (race.chooseTwo) {
    if (new Set(chosen).size !== 2) throw new Error(`${race.name} needs two different stats chosen for +1`);
    for (const s of chosen) mods[s] += 1;
  }
  return mods;
}

export function clampScore(value: number): number {
  return Math.max(SCORE_MIN, Math.min(SCORE_MAX, value));
}

/** Final scores: rolled total plus racial modifier, held to 6 to 18. */
export function finalScores(rolled: Record<Stat, number>, mods: Record<Stat, number>): Record<Stat, number> {
  return Object.fromEntries(STATS.map((s) => [s, clampScore(rolled[s] + mods[s])])) as Record<Stat, number>;
}
