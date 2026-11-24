// Coins and paying for things. Exchange rates are the standard 5e ones, chosen by David; they are
// not in the docs (written from memory, flagged in the rules report): 1 pp = 10 gp, 1 gp = 10 sp,
// 1 sp = 10 cp. Equipment costs in the Weapons and Armour sheet are in gp.
import { decisions } from "../rules";

export interface Coins {
  pp: number;
  gp: number;
  sp: number;
  cp: number;
}

export const COIN_KEYS = ["pp", "gp", "sp", "cp"] as const;
export const noCoins = (): Coins => ({ pp: 0, gp: 0, sp: 0, cp: 0 });

/** Value of each coin in copper. */
const VALUE: Record<keyof Coins, number> = decisions.coins.valueInCopper as Record<keyof Coins, number>;

export const totalCopper = (c: Coins) => COIN_KEYS.reduce((t, k) => t + c[k] * VALUE[k], 0);

/** A cost in gp (as the sheet writes it, e.g. 0.05) in copper. */
export const gpToCopper = (gp: number) => Math.round(gp * VALUE.gp);

/** "5 cp", "2 sp", "15 gp": a cost written in the largest coin that divides it. */
export function costText(gp: number): string {
  const cp = gpToCopper(gp);
  for (const k of COIN_KEYS) if (k !== "pp" && cp % VALUE[k] === 0) return `${cp / VALUE[k]} ${k}`;
  return `${cp} cp`;
}

/**
 * Pays a cost from the coins on hand, smallest coins first, giving change in smaller coins when a
 * bigger coin has to be broken. Returns the coins left, or null if there is not enough money.
 */
export function pay(purse: Coins, costCopper: number): Coins | null {
  if (costCopper <= 0) return { ...purse };
  if (totalCopper(purse) < costCopper) return null;
  const left = { ...purse };
  let owed = costCopper;
  for (const k of ["cp", "sp", "gp", "pp"] as const) {
    if (owed <= 0) break;
    const use = Math.min(left[k], Math.ceil(owed / VALUE[k]));
    left[k] -= use;
    owed -= use * VALUE[k];
  }
  // owed is now 0 or negative; the negative part is change, given as gp, then sp, then cp.
  let change = -owed;
  for (const k of ["gp", "sp", "cp"] as const) {
    const n = Math.floor(change / VALUE[k]);
    left[k] += n;
    change -= n * VALUE[k];
  }
  return left;
}
