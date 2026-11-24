// Page 2 for spellcasters, following the approved page 2 wireframes
// (design/wireframes/page2-<class>.dc.html) and docs/character-sheet-spec.md.
// Wizards list their spellbook; other casters see their whole class list and tick what they prepare.
import { spells, turnUndead } from "../rules";
import type { Character } from "../model/character";
import { slotTable, turnUndeadColumn, type SheetView } from "./derived";
import type { Update } from "./Page1";

const sign = (n: number) => (n > 0 ? `+${n}` : `${n}`);
const ordinal = (n: number) => `${n}${n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"}`;

export function Page2({ c, view, update }: { c: Character; view: SheetView; update: Update }) {
  const casting = view.spellcasting;
  if (!casting) return null;
  const list = spells[c.cls]?.levels ?? {};
  const slots = slotTable(c.cls, c.level).filter((s) => s.max > 0 && (list[String(s.spellLevel)]?.length ?? 0) > 0);
  const isWizard = c.cls === "Wizard";
  const setPlay = (patch: Partial<Character["play"]>) => update((ch) => ({ ...ch, play: { ...ch.play, ...patch } }));
  const togglePrepared = (name: string) =>
    setPlay({ prepared: c.play.prepared.includes(name) ? c.play.prepared.filter((p) => p !== name) : [...c.play.prepared, name] });
  const setSpent = (i: number, n: number) => {
    const next = [...c.play.slotsSpent];
    next[i] = n;
    setPlay({ slotsSpent: next });
  };
  const attackTotal = casting.spellAttack + c.play.spellAttackMisc;
  const statPart = isWizard ? view.bonuses.spellAttack : 0;
  const tu = turnUndeadColumn(c.cls, c.level);
  const showTurnUndead = c.cls === "Cleric" || c.cls === "Paladin";

  return (
    <div class="pg page2">
      <div class="hdr2">
        <div>
          <div class="l">Name</div>
          <div class="b val">{c.name}</div>
        </div>
        <div>
          <div class="l">Class and level</div>
          <div class="b val">{`${c.cls} ${c.level}`}</div>
        </div>
        <div class="atk">
          <div>
            <div class="l">Spell atk</div>
            <div class="b val thick">{sign(attackTotal)}</div>
          </div>
          <div class="op">=</div>
          <div>
            <div class="l">Base</div>
            <div class="b val">{sign(casting.spellAttack - statPart)}</div>
          </div>
          {isWizard && (
            <>
              <div class="op">+</div>
              <div>
                <div class="l">INT</div>
                <div class="b val">{sign(statPart)}</div>
              </div>
            </>
          )}
          <div class="op">+</div>
          <div>
            <div class="l">Misc</div>
            <input
              class="b in num"
              type="text"
              inputMode="numeric"
              aria-label="Spell attack misc"
              value={c.play.spellAttackMisc ? String(c.play.spellAttackMisc) : ""}
              onChange={(e) => setPlay({ spellAttackMisc: Number.parseInt((e.target as HTMLInputElement).value, 10) || 0 })}
            />
          </div>
        </div>
        <div>
          <div class="l">{casting.potencyKind === "arcane" ? "Arcane potency" : "Divine potency"}</div>
          <div class="b val">{sign(casting.potency)}</div>
        </div>
      </div>

      <div class="levels">
        {casting.cantrips > 0 && (
          <section class="lvl">
            <div class="sh">Cantrips ({casting.cantrips})</div>
            <ul class="spells">
              {c.cantrips.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </section>
        )}
        {slots.map(({ spellLevel, max, now }, i) => {
          const spent = Math.min(c.play.slotsSpent[i] ?? 0, now);
          const names = isWizard ? c.knownSpells.filter((s) => list[String(spellLevel)]?.includes(s)) : (list[String(spellLevel)] ?? []);
          return (
            <section key={spellLevel} class={now === 0 ? "lvl locked" : "lvl"}>
              <div class="sh">{ordinal(spellLevel)} level</div>
              <div class="slots">
                <span class="l left">Slots</span>
                {Array.from({ length: max }, (_, k) => (
                  <span key={k} class={k < now ? "tick have" : "tick"} title={k < now ? "Slot you have" : "Slot at a higher level"} />
                ))}
                <span class="l left gap">Spent</span>
                {Array.from({ length: now }, (_, k) => (
                  <input key={k} type="checkbox" aria-label={`${ordinal(spellLevel)} level slot ${k + 1} spent`} checked={k < spent} onChange={() => setSpent(i, k < spent ? k : k + 1)} />
                ))}
              </div>
              <ul class="spells">
                {names.map((s) => (
                  <li key={s}>
                    <label>
                      <input type="checkbox" aria-label={`${s} prepared`} checked={c.play.prepared.includes(s)} onChange={() => togglePrepared(s)} />
                      {s}
                    </label>
                  </li>
                ))}
              </ul>
              {isWizard && <AddSpell options={(list[String(spellLevel)] ?? []).filter((s) => !c.knownSpells.includes(s))} onAdd={(s) => update((ch) => ({ ...ch, knownSpells: [...ch.knownSpells, s] }))} />}
            </section>
          );
        })}
      </div>

      {showTurnUndead && (
        <div class="turn">
          <div class="sh left">Turn Undead{c.cls === "Paladin" ? " (two levels lower)" : ""}</div>
          <table>
            <thead>
              <tr>
                <th>DL</th>
                {turnUndead.columns.map((col, i) => (
                  <th key={col} class={i === tu ? "on" : ""}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {turnUndead.rows.map((r) => (
                <tr key={r.dl}>
                  <th>{r.dl}</th>
                  {r.values.map((v, i) => (
                    <td key={i} class={i === tu ? "on" : ""}>
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p class="note">{turnUndead.note}</p>
        </div>
      )}
    </div>
  );
}

function AddSpell({ options, onAdd }: { options: string[]; onAdd: (s: string) => void }) {
  if (options.length === 0) return null;
  return (
    <select class="add" aria-label="Add a spell to the spellbook" value="" onChange={(e) => onAdd((e.target as HTMLSelectElement).value)}>
      <option value="">Add to spellbook...</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}
