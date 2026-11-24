// Page 1 of the sheet (all classes), laid out as the approved print wireframe
// (design/wireframes/page1-print.dc.html). Worked-out values are plain text; things
// that change in play are inputs.
import type { JSX } from "preact";
import { armour as armourList, weapons as weaponList, type SaveKey } from "../rules";
import { isRangedWeapon } from "../engine/equipment";
import { EXPERIENCE_LINES, type Character, type PlayState, type WeaponRow } from "../model/character";
import { alignmentShort, classAndLevel, type SheetView, type WeaponRowView } from "./derived";

export type Update = (fn: (c: Character) => Character) => void;

const sign = (n: number) => (n > 0 ? `+${n}` : `${n}`);

const SAVE_ROWS: { key: SaveKey; label: string }[] = [
  { key: "spell", label: "Spell" },
  { key: "blastBarrage", label: "Blast / Barrage" },
  { key: "petrificationPolymorph", label: "Petrification / Polymorph" },
  { key: "magicItem", label: "Magic Item" },
  { key: "deathParalyze", label: "Death / Paralyze" },
];

const MELEE_WEAPONS = weaponList.filter((w) => !isRangedWeapon(w)).map((w) => w.name);
const RANGED_WEAPONS = weaponList.filter((w) => isRangedWeapon(w)).map((w) => w.name);

/** A text input that holds a whole number (or blank). */
function NumInput({ value, onChange, label, class: cls, placeholder }: { value: number | null; onChange: (v: number | null) => void; label: string; class?: string; placeholder?: string }) {
  return (
    <input
      class={`b in num ${cls ?? ""}`}
      type="text"
      inputMode="numeric"
      aria-label={label}
      value={value === null ? "" : String(value)}
      placeholder={placeholder}
      onChange={(e) => {
        const t = (e.target as HTMLInputElement).value.trim();
        const n = Number.parseInt(t, 10);
        onChange(t === "" || Number.isNaN(n) ? null : n);
      }}
    />
  );
}

function TextInput({ value, onChange, label, class: cls }: { value: string; onChange: (v: string) => void; label: string; class?: string }) {
  return <input class={`in ${cls ?? ""}`} type="text" aria-label={label} value={value} onInput={(e) => onChange((e.target as HTMLInputElement).value)} />;
}

const Box = ({ children, class: cls, style }: { children?: JSX.Element | string | number | null; class?: string; style?: string }) => (
  <div class={`b val ${cls ?? ""}`} style={style}>
    {children}
  </div>
);

export function Page1({ c, view, update }: { c: Character; view: SheetView; update: Update }) {
  const play = (patch: Partial<PlayState>) => update((ch) => ({ ...ch, play: { ...ch.play, ...patch } }));
  const b = view.bonuses;
  const extraLines = Math.max(0, EXPERIENCE_LINES - view.experiences.length);

  return (
    <div class="pg page1">
      <div class="hdr">
        <div>
          <div class="l">Name</div>
          <Box>{c.name}</Box>
        </div>
        <div>
          <div class="l">Race</div>
          <Box>{c.race}</Box>
        </div>
        <div>
          <div class="l">Class and level</div>
          <Box>{classAndLevel(c)}</Box>
        </div>
        <div>
          <div class="l">XP</div>
          <NumInput label="XP" value={c.xp} onChange={(v) => update((ch) => ({ ...ch, xp: v ?? 0 }))} />
        </div>
        <div>
          <div class="l">Align</div>
          <Box>{alignmentShort(c.alignment)}</Box>
        </div>
        <div>
          <div class="l">Move</div>
          <Box>{view.move}</Box>
        </div>
        <div>
          <div class="l">Atk Bns</div>
          <Box class="thick">{sign(view.attackBonus)}</Box>
        </div>
      </div>

      <div class="main">
        <div class="col">
          <div class="sh">Stats</div>
          {(["STR", "DEX", "CON", "INT", "WIS", "CHA"] as const).map((s) => (
            <div key={s} class="row stat">
              <b>{s}</b>
              <Box class="score">{view.scores[s]}</Box>
            </div>
          ))}
        </div>

        <div class="col">
          <div class="sh">Stat bonuses</div>
          <BonusRow items={[["Melee hit", sign(b.meleeHit)], ["Damage", sign(b.damage)], null]} />
          <BonusRow items={[["Ranged hit", sign(b.rangedHit)], ["AC", sign(b.ac)], ["Blast save", sign(b.blastSave)]]} />
          <BonusRow items={[["HP per hit die", view.conColumns.map(sign).join(" / ")]]} />
          <BonusRow items={[["Languages", String(b.languages)], ["Spell attack", sign(b.spellAttack)], ["Arcane potency", sign(b.arcanePotency)]]} />
          <BonusRow items={[["Divine potency", sign(b.divinePotency)], ["Mind spell save", sign(b.mindSpellSave)], null]} />
          <div class="br" />
        </div>

        <div class="col hp">
          <div class="sh">HP</div>
          <div>
            <div class="l">Max</div>
            <Box class="max">{view.hpMax}</Box>
          </div>
          <div>
            <div class="l">Current</div>
            <NumInput label="Current HP" class="current" value={c.play.hpCurrent} placeholder={view.hpMax === null ? "" : String(view.hpMax)} onChange={(v) => play({ hpCurrent: v })} />
          </div>
          <div>
            <div class="l">Temp HP</div>
            <NumInput label="Temp HP" class="temp" value={c.play.tempHp} onChange={(v) => play({ tempHp: v })} />
          </div>
          <div>
            <div class="l">Hit dice</div>
            {view.hitDice.map((h) => (
              <Box key={h.cls} class="hd">
                {view.hitDice.length > 1 ? `${h.dice} ${h.cls}` : h.dice}
              </Box>
            ))}
            {c.play.hitDiceLines.slice(0, Math.max(0, 3 - view.hitDice.length)).map((line, i) => (
              <TextInput
                key={i}
                class="b hd"
                label={`Hit dice line ${view.hitDice.length + i + 1}`}
                value={line}
                onChange={(v) => play({ hitDiceLines: (i === 0 ? [v, c.play.hitDiceLines[1]] : [c.play.hitDiceLines[0], v]) as [string, string] })}
              />
            ))}
          </div>
        </div>

        <div class="col exp">
          <div class="sh">Experiences</div>
          {view.experiences.map((e) => (
            <div key={e} class="ln">
              {e}
            </div>
          ))}
          {Array.from({ length: extraLines }, (_, i) => (
            <TextInput
              key={i}
              class="ln"
              label={`Experience ${view.experiences.length + i + 1}`}
              value={c.play.extraExperiences[i] ?? ""}
              onChange={(v) => {
                const next = [...c.play.extraExperiences];
                next[i] = v;
                play({ extraExperiences: next });
              }}
            />
          ))}
        </div>

        <div class="col saves">
          <div class="sh">Saving throws</div>
          <div class="sg head">
            <div class="l left">Type</div>
            <div class="l">Total</div>
            <div class="l">Base</div>
            <div class="l">BNS</div>
          </div>
          {SAVE_ROWS.map(({ key, label }) => {
            const s = view.saves[key];
            return (
              <div key={key} class="sv">
                <div class="sg">
                  <div>{label}</div>
                  <Box class="thick">{s.total}</Box>
                  <Box>{s.base}</Box>
                  <Box>{s.bonus ? sign(s.bonus) : ""}</Box>
                </div>
                <div class="nt">
                  {s.notes.length > 0 && <span class="derived">{s.notes.join("; ")}</span>}
                  <TextInput label={`${label} note`} value={c.play.saveNotes[key]} onChange={(v) => play({ saveNotes: { ...c.play.saveNotes, [key]: v } })} />
                </div>
              </div>
            );
          })}
          <div class="sv last">
            {view.generalSaveNotes.map((n) => (
              <div key={n} class="nt">
                <span class="derived">Any save: {n}</span>
              </div>
            ))}
            {c.play.spareSaveNotes.slice(view.generalSaveNotes.length).map((v, i) => {
              const idx = i + view.generalSaveNotes.length;
              return (
                <div key={idx} class="nt">
                  <TextInput
                    label={`Save note ${idx + 1}`}
                    value={v}
                    onChange={(t) => {
                      const next = [...c.play.spareSaveNotes] as [string, string];
                      next[idx] = t;
                      play({ spareSaveNotes: next });
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div class="acrow">
        <div class="w40">
          <div class="l">AC</div>
          <Box class="thick big">{view.ac.total}</Box>
        </div>
        <div class="op">=</div>
        <div class="w190">
          <div class="l">Armour</div>
          <select class="b in" aria-label="Armour" value={c.play.armour ?? ""} onChange={(e) => play({ armour: (e.target as HTMLSelectElement).value || null })}>
            <option value="">None</option>
            {armourList
              .filter((a) => a.baseAC !== null)
              .map((a) => (
                <option key={a.name} value={a.name}>
                  {a.name}
                </option>
              ))}
          </select>
        </div>
        <div class="w36">
          <div class="l">AC</div>
          <Box>{view.ac.base}</Box>
        </div>
        <div class="op">+</div>
        <div class="w36">
          <div class="l">Shield</div>
          <label class="b val check">
            <input type="checkbox" aria-label="Shield" checked={c.play.shield} onChange={(e) => play({ shield: (e.target as HTMLInputElement).checked })} />
            {view.ac.shield ? String(view.ac.shield) : ""}
          </label>
        </div>
        <div class="op">+</div>
        <div class="w36">
          <div class="l">DEX</div>
          <Box>{view.ac.dex}</Box>
        </div>
        <div class="op">+</div>
        <div class="w36">
          <div class="l">Misc</div>
          <NumInput label="AC misc" value={c.play.acMisc || null} onChange={(v) => play({ acMisc: v ?? 0 })} />
        </div>
        <div class="grow">
          <div class="l">Note</div>
          <TextInput class="b" label="AC note" value={c.play.acNote} onChange={(v) => play({ acNote: v })} />
        </div>
      </div>

      <WeaponTable
        title="Melee weapons"
        ranged={false}
        rows={view.melee}
        options={MELEE_WEAPONS}
        onChange={(i, row) => play({ melee: c.play.melee.map((r, j) => (j === i ? row : r)) })}
      />
      <WeaponTable
        title="Ranged weapons"
        ranged
        rows={view.ranged}
        options={RANGED_WEAPONS}
        onChange={(i, row) => play({ ranged: c.play.ranged.map((r, j) => (j === i ? row : r)) })}
      />

      <div class="bottom">
        <div class="sh">Abilities / Languages</div>
        <div class="sh span2">Inventory / Notes</div>
        <div class="abilities">
          <ul>
            {view.abilities.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
          <div class="l left">Languages ({view.bonuses.languages})</div>
          {view.languages.length > 0 && <div class="known-langs">{view.languages.join(", ")}</div>}
          <LinedText small label="Languages" value={c.play.languages} onChange={(v) => play({ languages: v })} />
        </div>
        <LinedText label="Inventory" value={c.play.inventory} onChange={(v) => play({ inventory: v })} />
        <LinedText label="Notes" value={c.play.notes} onChange={(v) => play({ notes: v })} />
      </div>
    </div>
  );
}

/** A ruled text area. Printing shows the text on ruled lines instead of the text box, which prints unreliably. */
function LinedText({ label, value, onChange, small }: { label: string; value: string; onChange: (v: string) => void; small?: boolean }) {
  return (
    <div class={small ? "lined small" : "lined"}>
      <textarea class="in area no-print" aria-label={label} value={value} onInput={(e) => onChange((e.target as HTMLTextAreaElement).value)} />
      <div class="print-only lines-text">{value}</div>
    </div>
  );
}

function BonusRow({ items }: { items: ([string, string] | null)[] }) {
  return (
    <div class="br">
      {items.map((it, i) =>
        it ? (
          <div key={i} class="bc">
            <div class="lw">{it[0]}</div>
            <Box>{it[1]}</Box>
          </div>
        ) : (
          <div key={i} class="sp" />
        ),
      )}
    </div>
  );
}

function WeaponTable({ title, ranged, rows, options, onChange }: { title: string; ranged: boolean; rows: WeaponRowView[]; options: string[]; onChange: (i: number, row: WeaponRow) => void }) {
  return (
    <div>
      <div class="sh left">{title}</div>
      <div class={ranged ? "wt ranged" : "wt melee"}>
        <div class="l">Name</div>
        {ranged && <div class="l">Range</div>}
        <div class="l">Hit Bns</div>
        <div class="l">Base</div>
        <div class="l">{ranged ? "DEX" : "STR"}</div>
        <div class="l">Mag</div>
        <div class="l">Damage</div>
        <div class="l">Type</div>
        <div class="l">Note</div>
        {rows.map(({ row, line }, i) => [
          <select key={`n${i}`} class="b in" aria-label={`${title} ${i + 1}`} value={row.name} onChange={(e) => onChange(i, { ...row, name: (e.target as HTMLSelectElement).value })}>
            <option value="" />
            {options.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>,
          ranged && <Box key={`r${i}`}>{line?.range ?? ""}</Box>,
          <Box key={`h${i}`} class="thick">{line ? sign(line.hitBonus) : ""}</Box>,
          <Box key={`b${i}`}>{line ? sign(line.base) : ""}</Box>,
          <Box key={`s${i}`}>{line ? sign(line.stat) : ""}</Box>,
          <NumInput key={`m${i}`} label={`${title} ${i + 1} magic`} value={row.magic || null} onChange={(v) => onChange(i, { ...row, magic: v ?? 0 })} />,
          <Box key={`d${i}`}>{line?.damage ?? ""}</Box>,
          <Box key={`t${i}`}>{line?.type ?? ""}</Box>,
          <TextInput key={`o${i}`} class="b" label={`${title} ${i + 1} note`} value={row.note} onChange={(v) => onChange(i, { ...row, note: v })} />,
        ])}
      </div>
    </div>
  );
}
