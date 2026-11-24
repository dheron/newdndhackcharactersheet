// Page 2 for spellcasters, following the approved page 2 wireframes
// (design/wireframes/page2-<class>.dc.html) and docs/character-sheet-spec.md.
// Wizards list their spellbook; other casters see their whole class list and tick what they prepare.
import { spells, turnUndead } from "../rules";
import { emptyCasting, type Character } from "../model/character";
import type { Caster } from "../engine/derive";
import { slotTable, turnUndeadColumn } from "./derived";
import type { Update } from "./Page1";

const sign = (n: number) => (n > 0 ? `+${n}` : `${n}`);
const ordinal = (n: number) => `${n}${n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"}`;

export function Page2({ c, caster, update }: { c: Character; caster: Caster; update: Update }) {
  const cls = caster.cls;
  const list = spells[cls]?.levels ?? {};
  const slots = slotTable(cls, caster.level).filter((s) => s.max > 0 && (list[String(s.spellLevel)]?.length ?? 0) > 0);
  const isWizard = cls === "Wizard";
  const mine = c.play.casting[cls] ?? emptyCasting();
  const setCasting = (patch: Partial<typeof mine>) =>
    update((ch) => ({ ...ch, play: { ...ch.play, casting: { ...ch.play.casting, [cls]: { ...(ch.play.casting[cls] ?? emptyCasting()), ...patch } } } }));
  const togglePrepared = (name: string) => setCasting({ prepared: mine.prepared.includes(name) ? mine.prepared.filter((p) => p !== name) : [...mine.prepared, name] });
  const setSpent = (i: number, n: number) => {
    const next = [...mine.slotsSpent];
    next[i] = n;
    setCasting({ slotsSpent: next });
  };
  const attackTotal = caster.spellAttack + mine.spellAttackMisc;
  const statPart = caster.spellAttackStat;
  const tu = turnUndeadColumn(cls, caster.level);
  const showTurnUndead = cls === "Cleric" || cls === "Paladin";

  return (
    <div class="pg page2">
      <div class="hdr2">
        <div>
          <div class="l">Name</div>
          <div class="b val">{c.name}</div>
        </div>
        <div>
          <div class="l">Class and level</div>
          <div class="b val">{`${cls} ${caster.level}`}</div>
        </div>
        <div class="atk">
          <div>
            <div class="l">Spell atk</div>
            <div class="b val thick">{sign(attackTotal)}</div>
          </div>
          <div class="op">=</div>
          <div>
            <div class="l">Base</div>
            <div class="b val">{sign(caster.spellAttack - statPart)}</div>
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
              value={mine.spellAttackMisc ? String(mine.spellAttackMisc) : ""}
              onChange={(e) => setCasting({ spellAttackMisc: Number.parseInt((e.target as HTMLInputElement).value, 10) || 0 })}
            />
          </div>
        </div>
        <div>
          <div class="l">{caster.potencyKind === "arcane" ? "Arcane potency" : "Divine potency"}</div>
          <div class="b val">{sign(caster.potency)}</div>
        </div>
      </div>

      <div class="levels">
        {caster.cantrips > 0 && (
          <section class="lvl">
            <div class="sh">Cantrips ({caster.cantrips})</div>
            <ul class="spells">
              {(c.cantrips[cls] ?? []).map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </section>
        )}
        {slots.map(({ spellLevel, max, now }, i) => {
          const spent = Math.min(mine.slotsSpent[i] ?? 0, now);
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
                      <input type="checkbox" aria-label={`${s} prepared`} checked={mine.prepared.includes(s)} onChange={() => togglePrepared(s)} />
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
          <div class="sh left">Turn Undead{cls === "Paladin" ? " (two levels lower)" : ""}</div>
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
