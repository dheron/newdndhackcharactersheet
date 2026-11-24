// Page 2 for spellcasters, following the approved page 2 wireframes
// (design/wireframes/page2-<class>.dc.html) and docs/character-sheet-spec.md.
// Wizards list their spellbook; other casters see their whole class list and tick what they prepare.
import { spells, turnUndead } from "../rules";
import { emptyCasting, type Character } from "../model/character";
import type { Caster } from "../engine/derive";
import { slotTable, turnUndeadColumn } from "./derived";
import { PAGE2_LAYOUT, type BoxId } from "./page2Layout";
import { useSpellInfo } from "../spells/SpellInfo";
import type { Update } from "./Page1";

const sign = (n: number) => (n > 0 ? `+${n}` : `${n}`);
const ordinal = (n: number) => `${n}${n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"}`;

export function Page2({ c, caster, castingOff, update }: { c: Character; caster: Caster; castingOff?: string; update: Update }) {
  const cls = caster.cls;
  const list = spells[cls]?.levels ?? {};
  const layout = PAGE2_LAYOUT[cls];
  if (!layout) return null;
  const slots = slotTable(cls, caster.level);
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
  const showTurnUndead = layout.turnUndead;
  const rowStyle = `height:${layout.rowHeight}px`;
  const cantrips = c.cantrips[cls] ?? [];

  const square = (key: number, filled: boolean) => <span key={key} class={filled ? "sq have" : "sq"} />;
  const slotBand = (i: number) => {
    const { max, now } = slots[i] ?? { max: 0, now: 0 };
    const spent = Math.min(mine.slotsSpent[i] ?? 0, now);
    const have = Array.from({ length: max }, (_, k) => square(k, k < now));
    const spentBoxes = Array.from({ length: max }, (_, k) =>
      k < now ? (
        <input key={k} type="checkbox" class="sq-check" aria-label={`${ordinal(i + 1)} level slot ${k + 1} spent`} checked={k < spent} onChange={() => setSpent(i, k < spent ? k : k + 1)} />
      ) : (
        square(k, false)
      ),
    );
    if (max === 0) return null;
    return layout.twoLineSlots ? (
      <div class="sb2">
        <div class="sbr">
          <span class="t">Slots</span>
          {have}
        </div>
        <div class="sbr">
          <span class="t">Spent</span>
          {spentBoxes}
        </div>
      </div>
    ) : (
      <div class="sb1">
        <span>Slots</span>
        {have}
        <span class="gap">Spent</span>
        {spentBoxes}
      </div>
    );
  };
  const spellRow = (s: string, label: string = s) => (
    <SpellRow key={s} name={s} label={label} style={rowStyle} checked={mine.prepared.includes(s)} onToggle={() => togglePrepared(s)} />
  );
  const box = (id: BoxId) => {
    if (id === "cantrips") {
      const lines = Math.max(layout.cantripLines, cantrips.length);
      return (
        <div key="c" class="bx">
          <div class="bh">Cantrips</div>
          <div class="pad">
            {Array.from({ length: lines }, (_, k) => (
              <div key={k} class="wl">
                <div class="nm">{cantrips[k] ?? ""}</div>
              </div>
            ))}
          </div>
        </div>
      );
    }
    const level = id;
    const all = list[String(level)] ?? [];
    const locked = (slots[level - 1]?.now ?? 0) === 0;
    if (isWizard) {
      const known = c.knownSpells.filter((s) => all.includes(s));
      const lines = Math.max(layout.spellbookLines?.[level - 1] ?? 0, known.length);
      return (
        <div key={level} class={locked ? "bx locked" : "bx"}>
          <div class="bh">{ordinal(level)} level</div>
          {slotBand(level - 1)}
          {Array.from({ length: lines }, (_, k) => {
            const s = known[k];
            return s ? (
              <SpellRow key={k} book name={s} label={s} style={rowStyle} checked={mine.prepared.includes(s)} onToggle={() => togglePrepared(s)} />
            ) : (
              <div key={k} class="rw book" style={rowStyle}>
                <span class="ck" />
                <span class="nm" />
              </div>
            );
          })}
          <AddSpell options={all.filter((s) => !c.knownSpells.includes(s))} onAdd={(s) => update((ch) => ({ ...ch, knownSpells: [...ch.knownSpells, s] }))} />
          <div style="height:4px" />
        </div>
      );
    }
    return (
      <div key={level} class={locked ? "bx locked" : "bx"}>
        <div class="bh">{ordinal(level)} level</div>
        {slotBand(level - 1)}
        <div class="pad">{all.map((sp) => spellRow(sp))}</div>
      </div>
    );
  };

  return (
    <div class={`pg page2 page2-${cls.toLowerCase()}`}>
      <div class="hdr2">
        <div class="name">
          <div class="l">Name</div>
          <div class="b val">{c.name}</div>
        </div>
        <div class="cls">
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
        <div class="pot">
          <div class="l">{caster.potencyKind === "arcane" ? "Arcane potency" : "Divine potency"}</div>
          <div class="b val thick">{sign(caster.potency)}</div>
        </div>
      </div>

      <p class="spell-hint no-print">To read a spell, rest the pointer on it, or on a touch screen press and hold it.</p>
      {castingOff && (
        <div class="banner" role="status">
          No spellcasting: {castingOff}
        </div>
      )}
      <div class={showTurnUndead ? "levels with-tu" : "levels"} style={`grid-template-columns:repeat(${layout.columns.length},minmax(0,1fr))`}>
        {layout.columns.map((col, k) => (
          <div key={k} class={isWizard ? "lcol wide" : "lcol"}>
            {col.map(box)}
            {k === 0 && cls === "Bard" && c.magicalSecrets.length > 0 && (
              <div class="bx">
                <div class="bh">Magical Secrets</div>
                <div class="pad">{c.magicalSecrets.map((m) => spellRow(m.spell, `${m.spell} (${m.from})`))}</div>
              </div>
            )}
          </div>
        ))}
      </div>

      {showTurnUndead && (
        <div class="turn">
          <div class="sh">Turn undead{cls === "Paladin" ? " (two levels lower)" : ""}</div>
          <table class="tu">
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

/** A spell with its Prepared tick box; hovering it (or holding it on a touch screen) shows the spell card. */
function SpellRow({ name, label, style, checked, onToggle, book }: { name: string; label: string; style: string; checked: boolean; onToggle: () => void; book?: boolean }) {
  const info = useSpellInfo(name);
  return (
    <label class={book ? "rw book" : "rw"} style={style} {...info}>
      <input type="checkbox" class="ck" aria-label={`${name} prepared`} checked={checked} onChange={onToggle} />
      <span class={book ? "nm" : ""}>{label}</span>
    </label>
  );
}

function AddSpell({ options, onAdd }: { options: string[]; onAdd: (s: string) => void }) {
  if (options.length === 0) return null;
  return (
    <select class="add no-print" aria-label="Add a spell to the spellbook" value="" onChange={(e) => onAdd((e.target as HTMLSelectElement).value)}>
      <option value="">Add to spellbook...</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}
