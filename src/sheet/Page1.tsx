// Page 1 of the sheet (all classes), laid out as the approved print wireframe
// (design/wireframes/page1-print.dc.html). Worked-out values are plain text; things
// that change in play are inputs.
import type { JSX } from "preact";
import type { SaveKey } from "../rules";
import type { Coins } from "../engine/coins";
import { classXp } from "../engine/levels";
import { EXPERIENCE_LINES, parseItem, type Character, type PlayState, type WeaponRow } from "../model/character";
import { alignmentShort, classAndLevel, takesNote, equipBlocked, equippable, inventoryOf, isEquipped, toggleEquip, type SheetView, type WeaponRowView } from "./derived";

export type Update = (fn: (c: Character) => Character) => void;

const sign = (n: number) => (n > 0 ? `+${n}` : `${n}`);

const SAVE_ROWS: { key: SaveKey; label: string }[] = [
  { key: "spell", label: "Spell" },
  { key: "blastBarrage", label: "Blast / Barrage" },
  { key: "petrificationPolymorph", label: "Petrification / Polymorph" },
  { key: "magicItem", label: "Magic Item" },
  { key: "deathParalyze", label: "Death / Paralyze" },
];

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
          <Box class="center">{c.race}</Box>
        </div>
        <div>
          <div class="l">Class and level</div>
          <Box>{classAndLevel(c)}</Box>
        </div>
        <div>
          <div class="l">XP</div>
          {c.classes.length > 1 ? (
            <Box class="xp-split">{c.xp ? c.classes.map(() => classXp(c)).join("/") : ""}</Box>
          ) : (
            <NumInput label="XP" value={c.xp || null} onChange={(v) => update((ch) => ({ ...ch, xp: v ?? 0 }))} />
          )}
        </div>
        <div>
          <div class="l">Align</div>
          <Box>{alignmentShort(c.alignment)}</Box>
        </div>
        <div>
          <div class="l">Move</div>
          <Box class="center">{view.move}</Box>
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
            <NumInput label="Current HP" class="current" value={c.play.hpCurrent} onChange={(v) => play({ hpCurrent: v })} />
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
              {c.expertise.includes(e) && <span class="xp-mark"> +4</span>}
            </div>
          ))}
          {Array.from({ length: extraLines }, (_, i) => (
<div key={i} class="ln-wrap">
              <TextInput
              class="ln"
              label={`Experience ${view.experiences.length + i + 1}`}
              value={c.play.extraExperiences[i] ?? ""}
              onChange={(v) => {
                const next = [...c.play.extraExperiences];
                next[i] = v;
                play({ extraExperiences: next });
              }}
            />
              {(c.play.extraExperiences[i] ?? "") !== "" && c.expertise.includes(c.play.extraExperiences[i]!) && <span class="xp-mark">+4</span>}
            </div>
          ))}
        </div>

        <div class="col saves">
          <div class="sh">Saving throws</div>
          <div class="sg head">
            <div class="l">Save</div>
            <div class="l">Type</div>
            <div class="l">Bonus</div>
          </div>
          {SAVE_ROWS.map(({ key, label }) => {
            const s = view.saves[key];
            return (
              <div key={key} class="sv">
                <div class="sg">
                  <Box class="thick">{s.base}</Box>
                  <div class="save-type">{label}</div>
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
          <select
            class="b in"
            aria-label="Armour"
            value={c.play.armour ?? ""}
            onChange={(e) => {
              const name = (e.target as HTMLSelectElement).value;
              update((ch) => (name ? toggleEquip({ ...ch, play: { ...ch.play, armour: null } }, { kind: "armour", name }) : { ...ch, play: { ...ch.play, armour: null } }));
            }}
          >
            <option value="">None</option>
            {[...new Set([...inventoryOf(c, "armour"), ...(c.play.armour ? [c.play.armour] : [])])].map((name) => {
              const why = c.play.armour === name ? null : equipBlocked(c, { kind: "armour", name });
              return (
                <option key={name} value={name} disabled={why !== null}>
                  {why ? `${name} (${why})` : name}
                </option>
              );
            })}
          </select>
        </div>
        <div class="w36">
          <div class="l">AC</div>
          <Box>{view.ac.base}</Box>
        </div>
        <div class="op">+</div>
        <div class="w36">
          <div class="l">Shield</div>
          <label class="b val check" title={(c.play.shield ? null : inventoryOf(c, "shield").length === 0 ? "No shield in the inventory" : equipBlocked(c, { kind: "shield", name: "Shield" })) ?? ""}>
            <input
              type="checkbox"
              aria-label="Shield equipped"
              checked={c.play.shield}
              disabled={(c.play.shield ? null : inventoryOf(c, "shield").length === 0 ? "No shield in the inventory" : equipBlocked(c, { kind: "shield", name: "Shield" })) !== null}
              onChange={() => update((ch) => toggleEquip(ch, { kind: "shield", name: "Shield" }))}
            />
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
          <div class="b val note-box">
            {view.armourWarnings.length > 0 && <span class="armour-warning">{view.armourWarnings.join("; ")}</span>}
            <TextInput label="AC note" value={c.play.acNote} onChange={(v) => play({ acNote: v })} />
          </div>
        </div>
      </div>

      <WeaponTable
        title="Melee weapons"
        ranged={false}
        rows={view.melee}
        options={inventoryOf(c, "melee")}
        onChange={(i, row) => play({ melee: c.play.melee.map((r, j) => (j === i ? row : r)) })}
      />
      <WeaponTable
        title="Ranged weapons"
        ranged
        rows={view.ranged}
        options={inventoryOf(c, "ranged")}
        onChange={(i, row) => play({ ranged: c.play.ranged.map((r, j) => (j === i ? row : r)) })}
      />

      <div class="bottom">
        <div class="sh">Abilities / Languages</div>
        <div class="sh span2">Inventory / Notes</div>
        <div class="abilities">
          <ul>
            {view.abilities.map((a) => (
              <li key={a.text} class={a.off ? "off" : ""}>
                {a.text}
                {a.off && <span class="why"> ({a.off})</span>}
                {takesNote(a.raw) && (
                  <>
                    {" "}
                    <input
                      class="in ability-note no-print"
                      type="text"
                      aria-label={`${a.raw.split(" - ")[0]} choice`}
                      placeholder="Terrain"
                      value={c.abilityNotes[a.raw] ?? ""}
                      onInput={(e) => update((ch) => ({ ...ch, abilityNotes: { ...ch.abilityNotes, [a.raw]: (e.target as HTMLInputElement).value } }))}
                    />
                    <span class="print-only-inline">{c.abilityNotes[a.raw] ? `Terrain: ${c.abilityNotes[a.raw]}` : ""}</span>
                  </>
                )}
              </li>
            ))}
          </ul>
          <div class="l left">Languages ({view.bonuses.languages})</div>
          {view.languages.length > 0 && <div class="known-langs">{view.languages.join(", ")}</div>}
          <LinedText small label="Languages" value={c.play.languages} onChange={(v) => play({ languages: v })} />
        </div>
        <Inventory c={c} update={update} />
        <LinedText label="Notes" value={c.play.notes} onChange={(v) => play({ notes: v })} />
      </div>
    </div>
  );
}

const INVENTORY_LINES = 9;

/**
 * Removes one of the item on an inventory line ("2 x Dagger" becomes "Dagger"; a single item's
 * line goes). Removing the last of an equipped item unequips it.
 */
export function removeOne(c: Character, index: number): Character {
  const line = c.play.inventory[index];
  if (line === undefined) return c;
  const { count, name } = parseItem(line);
  const item = equippable(line);
  const inventory = count > 1 ? c.play.inventory.map((l, j) => (j === index ? (count - 1 > 1 ? `${count - 1} x ${name}` : name) : l)) : c.play.inventory.filter((_, j) => j !== index);
  let next: Character = { ...c, play: { ...c.play, inventory } };
  const stillHave = item ? inventory.some((l) => equippable(l)?.name === item.name) : true;
  if (item && !stillHave && isEquipped(next, item)) next = toggleEquip(next, item);
  return next;
}

/**
 * The inventory, one item per line. Armour, shields and weapons have a tick box to equip or
 * unequip them; equipped armour sets the AC row and equipped weapons fill the weapon rows.
 */
function Inventory({ c, update }: { c: Character; update: Update }) {
  const lines = [...c.play.inventory];
  const shown = Math.max(INVENTORY_LINES, lines.length + 1);
  const setLine = (i: number, text: string) =>
    update((ch) => {
      const next = [...ch.play.inventory];
      next[i] = text;
      while (next.length > 0 && next[next.length - 1]!.trim() === "") next.pop();
      return { ...ch, play: { ...ch.play, inventory: next.map((l) => l ?? "") } };
    });
  const coin = (key: keyof Coins, label: string) => (
    <label class="coin">
      <span>{label}:</span>
      <input
        class="in num"
        type="text"
        inputMode="numeric"
        aria-label={label}
        value={c.play.coins[key] ? String(c.play.coins[key]) : ""}
        onChange={(e) => {
          const n = Number.parseInt((e.target as HTMLInputElement).value, 10);
          update((ch) => ({ ...ch, play: { ...ch.play, coins: { ...ch.play.coins, [key]: Number.isNaN(n) ? 0 : Math.max(0, n) } } }));
        }}
      />
    </label>
  );
  return (
    <div class="lined inventory">
      <div class="coins">
        {coin("pp", "Platinum")}
        {coin("gp", "Gold")}
        {coin("sp", "Silver")}
        {coin("cp", "Copper")}
      </div>
      <div class="no-print">
        {Array.from({ length: shown }, (_, i) => {
          const line = lines[i] ?? "";
          const item = equippable(line);
          const on = item ? isEquipped(c, item) : false;
          const why = item ? equipBlocked(c, item) : null;
          return (
            <div key={i} class={on ? "inv-row on" : "inv-row"}>
              {item ? (
                <input
                  type="checkbox"
                  class="ck"
                  aria-label={`${item.name} equipped`}
                  title={why ?? (on ? "Equipped: untick to unequip" : "Tick to equip")}
                  checked={on}
                  disabled={why !== null}
                  onChange={() => update((ch) => toggleEquip(ch, item))}
                />
              ) : (
                <span class="ck-pad" />
              )}
              <input class="in ln" type="text" aria-label={`Inventory line ${i + 1}`} value={line} onInput={(e) => setLine(i, (e.target as HTMLInputElement).value)} />
              {line.trim() !== "" && (
                <button type="button" class="inv-remove" aria-label={`Remove one ${parseItem(line).name}`} title="Remove one" onClick={() => update((ch) => removeOne(ch, i))}>
                  ×
                </button>
              )}
            </div>
          );
        })}
      </div>
      <div class="print-only lines-text">{lines.join("\n")}</div>
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
        {rows.map(({ row, line, warning }, i) => [
          <select key={`n${i}`} class="b in" aria-label={`${title} ${i + 1}`} value={row.name} onChange={(e) => onChange(i, { ...row, name: (e.target as HTMLSelectElement).value })}>
            <option value="" />
            {[...new Set([...options.filter((o) => !rows.some((r, j) => j !== i && r.row.name === o)), ...(row.name ? [row.name] : [])])].map((o) => (
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
          <div key={`o${i}`} class="b val note-box">
            {warning && <span class="armour-warning">{warning}</span>}
            <TextInput label={`${title} ${i + 1} note`} value={row.note} onChange={(v) => onChange(i, { ...row, note: v })} />
          </div>,
        ])}
      </div>
    </div>
  );
}
