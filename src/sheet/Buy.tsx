// Buying weapons and armour from the Weapons and Armour sheet: pays from the coins on hand
// (src/engine/coins.ts) and adds the item to the inventory.
import { useState } from "preact/hooks";
import { armour, weapons } from "../rules";
import { costText, gpToCopper, pay } from "../engine/coins";
import { parseItem, type Character } from "../model/character";

type Tab = "weapons" | "armour";

/** Adds one of an item to the inventory, counting it up if it is already there ("2 x Dagger"). */
export function addToInventory(lines: string[], name: string): string[] {
  const i = lines.findIndex((l) => parseItem(l).name.toLowerCase() === name.toLowerCase());
  if (i < 0) return [...lines, name];
  const { count } = parseItem(lines[i]!);
  return lines.map((l, j) => (j === i ? `${count + 1} x ${name}` : l));
}

export function buy(c: Character, name: string, costGp: number): Character | null {
  const coins = pay(c.play.coins, gpToCopper(costGp));
  if (!coins) return null;
  return { ...c, play: { ...c.play, coins, inventory: addToInventory(c.play.inventory, name) } };
}

export function BuyDialog({ c, onBuy, onClose }: { c: Character; onBuy: (next: Character, bought: string) => void; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("weapons");
  const purse = c.play.coins;
  const rows =
    tab === "weapons"
      ? weapons.map((w) => ({ name: w.name, cost: w.cost, detail: [w.damage ?? "", w.type ?? "", w.range ?? "", ...w.traits].filter(Boolean).join(", ") }))
      : armour.map((a) => ({ name: a.name, cost: a.cost, detail: [`AC ${a.acText}`, a.strReq ? `Str ${a.strReq}` : "", a.notes ?? ""].filter(Boolean).join(", ") }));
  return (
    <div class="overlay" role="dialog" aria-modal="true" aria-labelledby="buy-title" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="panel">
        <h2 id="buy-title">Buy equipment</h2>
        <p class="hint">
          Coins: {purse.pp} pp, {purse.gp} gp, {purse.sp} sp, {purse.cp} cp. Bought items go into the inventory; tick them there to equip.
        </p>
        <div class="chips" role="group" aria-label="Kind">
          {(["weapons", "armour"] as const).map((t) => (
            <button key={t} type="button" class={tab === t ? "chip on" : "chip"} aria-pressed={tab === t} onClick={() => setTab(t)}>
              {t === "weapons" ? "Weapons" : "Armour"}
            </button>
          ))}
        </div>
        <ul class="buy-list">
          {rows.map((r) => {
            const affordable = r.cost !== null && pay(purse, gpToCopper(r.cost)) !== null;
            return (
              <li key={r.name}>
                <span class="buy-name">{r.name}</span>
                <span class="buy-detail">{r.detail}</span>
                <span class="buy-cost">{r.cost === null ? "TBD" : costText(r.cost)}</span>
                <button
                  type="button"
                  disabled={!affordable}
                  title={r.cost === null ? "No cost in the sheet" : affordable ? "" : "Not enough coins"}
                  onClick={() => {
                    const next = r.cost === null ? null : buy(c, r.name, r.cost);
                    if (next) onBuy(next, r.name);
                  }}
                >
                  Buy
                </button>
              </li>
            );
          })}
        </ul>
        <div class="actions">
          <button type="button" class="primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
