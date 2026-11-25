import { useRef, useState } from "preact/hooks";
import { CLASS_NAMES, STATS, abilitiesUpTo, classes, hitDie, multiclass as multiclassRules, raceByName, races, type ClassName, type Stat } from "../rules";
import { EXPECTED_ROLL, ROLL_METHODS, capWasteChance, rollForPick } from "../engine/abilities";
import { rollTotal } from "../engine/dice";
import { WEAPON_FILTERS, armourByName, armourChoosable, optionAvailable, optionsFor, weaponsFor, type Slot } from "../engine/equipment";
import { decisions } from "../rules";
import { classesLabel, multiclassOptions } from "../engine/multiclass";
import { SpellChip } from "../spells/SpellInfo";
import { coreSkillOptions, randomExamples, startingExamples } from "./experienceOptions";
import { saveCharacter } from "../library";
import type { Character } from "../model/character";
import {
  cantripCount,
  cantripList,
  creationCasters,
  currentStep,
  emptyDraft,
  equipmentFor,
  experienceSlots,
  expertiseChoices,
  expertiseCount,
  knowableSpellLevels,
  knownSpellCount,
  modifiers,
  needsRaceChoices,
  raceReady,
  scores,
  slotsWithKeys,
  spellList,
  stepComplete,
  stepsFor,
  toCharacter,
  withClass,
  withClasses,
  withEquipmentClass,
  withMulticlass,
  withRace,
  type Draft,
  type StepId,
} from "./draft";

const STEP_TITLES: Record<StepId, string> = {
  race: "Name, race and alignment",
  stats: "Ability scores",
  class: "Class",
  experiences: "Experiences",
  equipment: "Equipment",
  spells: "Spells",
  done: "Character",
};

const sign = (n: number) => (n > 0 ? `+${n}` : `${n}`);
const modsText = (mods: Partial<Record<Stat, number>>) =>
  Object.entries(mods)
    .filter(([, v]) => v)
    .map(([k, v]) => `${sign(v!)} ${k}`)
    .join(", ");

export function Creation({ onFinish }: { onFinish: (c: Character) => void }) {
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editing, setEditing] = useState<StepId | null>(null);
  const update = (patch: Partial<Draft> | ((d: Draft) => Draft)) => setDraft((d) => (typeof patch === "function" ? patch(d) : { ...d, ...patch }));

  const steps = stepsFor(draft);
  const active = editing ?? currentStep(draft);
  const activeIndex = steps.indexOf(active);

  return (
    <div class="creation">
      <ol class="progress" aria-label="Steps">
        {steps.map((s, i) => (
          <li key={s} class={s === active ? "on" : i < activeIndex || stepComplete(draft, s) ? "done" : ""}>
            {STEP_TITLES[s]}
          </li>
        ))}
      </ol>

      {steps
        .filter((s) => s !== active && s !== "done" && stepComplete(draft, s) && steps.indexOf(s) < Math.max(activeIndex, steps.indexOf(currentStep(draft))))
        .map((s) => (
          <button key={s} type="button" class="summary" onClick={() => setEditing(s)}>
            <span class="summary-label">{STEP_TITLES[s]}</span>
            <span class="summary-value">{summaryText(draft, s)}</span>
            <span class="summary-edit">Edit</span>
          </button>
        ))}

      <section class="step" aria-labelledby="step-title">
        <h2 id="step-title">{STEP_TITLES[active]}</h2>
        {active === "race" && <RaceStep draft={draft} update={update} />}
        {active === "stats" && <StatsStep draft={draft} update={update} />}
        {active === "class" && <ClassStep draft={draft} update={update} />}
        {active === "experiences" && <ExperiencesStep draft={draft} update={update} />}
        {active === "equipment" && <EquipmentStep draft={draft} update={update} />}
        {active === "spells" && <SpellsStep draft={draft} update={update} />}
        {active === "done" && (
          <DoneStep
            draft={draft}
            onNew={() => {
              setDraft(emptyDraft());
              setEditing(null);
            }}
            onFinish={onFinish}
          />
        )}
        {editing && (
          <div class="actions">
            <button type="button" class="primary" disabled={!stepComplete(draft, editing)} onClick={() => setEditing(null)}>
              Done
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

function summaryText(d: Draft, step: StepId): string {
  switch (step) {
    case "race": {
      const mods = d.race ? modsText(modifiers(d)) : "";
      return `${d.name}, ${d.race}${mods ? ` (${mods})` : ""}, ${d.alignment}`;
    }
    case "stats": {
      const s = scores(d);
      return s ? STATS.map((k) => `${k} ${s[k]}`).join("  ") : "";
    }
    case "class":
      return `${classesLabel(d.classes)}${d.specialization ? `, Weapon Specialization: ${d.specialization}` : ""}`;
    case "experiences":
      return [...experienceSlots(d).fixed, ...d.experiences].map((e) => (d.expertise.includes(e) ? `${e} (Expertise)` : e)).join(", ");
    case "equipment": {
      const e = equipmentFor(d);
      const from = d.classes.length > 1 && d.equipmentClass ? `${d.equipmentClass} options: ` : "";
      return from + [e.armour, e.shield ? "Shield" : null, ...e.weapons, d.gold ? `${d.gold.total} gp` : null].filter(Boolean).join(", ");
    }
    case "spells":
      return [...Object.values(d.cantrips).flat(), ...d.knownSpells].join(", ");
    default:
      return "";
  }
}

type StepProps = { draft: Draft; update: (patch: Partial<Draft> | ((d: Draft) => Draft)) => void };

function RaceStep({ draft, update }: StepProps) {
  const race = draft.race ? raceByName(draft.race) : null;
  return (
    <>
      <label class="field">
        <span>Name</span>
        <input type="text" value={draft.name} onInput={(e) => update({ name: (e.target as HTMLInputElement).value })} autoFocus />
      </label>
      <label class="field">
        <span>Race</span>
        <select value={draft.race ?? ""} onChange={(e) => update((d) => withRace(d, (e.target as HTMLSelectElement).value))}>
          <option value="" disabled>
            Choose a race
          </option>
          {races.map((r) => (
            <option key={r.name} value={r.name}>
              {r.name} ({r.chooseTwo ? "+1 to any two" : modsText(r.modifiers)})
            </option>
          ))}
        </select>
      </label>
      {race && <p>Move {race.move} ft</p>}
      {race && (
        <ul class="traits">
          {race.traits.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      )}
      {needsRaceChoices(draft) && (
        <fieldset class="field">
          <legend>Choose two stats for +1 ({2 - draft.raceChoices.length} left)</legend>
          <div class="chips">
            {STATS.map((s) => {
              const on = draft.raceChoices.includes(s);
              return (
                <button
                  key={s}
                  type="button"
                  class={on ? "chip on" : "chip"}
                  aria-pressed={on}
                  disabled={!on && draft.raceChoices.length >= 2}
                  onClick={() => update((d) => ({ ...d, raceChoices: on ? d.raceChoices.filter((x) => x !== s) : [...d.raceChoices, s] }))}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}
      <label class="field">
        <span>Alignment</span>
        <select value={draft.alignment} onChange={(e) => update({ alignment: (e.target as HTMLSelectElement).value })}>
          <option value="" disabled>
            Choose an alignment
          </option>
          {decisions.alignments.list.map((a) => (
            <option key={a.name} value={a.name}>
              {a.name}
            </option>
          ))}
        </select>
      </label>
      {!draft.raceConfirmed && (
        <div class="actions">
          <button type="button" class="primary" disabled={!raceReady(draft)} onClick={() => update({ raceConfirmed: true })}>
            Next
          </button>
        </div>
      )}
    </>
  );
}

function StatsStep({ draft, update }: StepProps) {
  const [preview, setPreview] = useState<Stat | null>(null);
  // A ref, not state: the click handler runs straight after pointerdown, before a re-render.
  const pointer = useRef<string>("mouse");
  const [touchMode, setTouchMode] = useState(false);
  const pick = draft.rolls.length;
  const mods = modifiers(draft);
  const rolled = new Set(draft.rolls.map((r) => r.stat));
  const final = scores(draft);
  const method = ROLL_METHODS[pick];

  const roll = (stat: Stat) => {
    update((d) => ({ ...d, rolls: [...d.rolls, rollForPick(stat, d.rolls.length)] }));
    setPreview(null);
  };
  const onStat = (stat: Stat) => {
    // Desktop: click rolls. Touch: first tap previews, second tap rolls.
    if (pointer.current !== "mouse" && preview !== stat) return setPreview(stat);
    roll(stat);
  };

  return (
    <>
      {method && (
        <p class="hint">
          Pick {pick + 1} of 6 rolls {method.label}. Pick the stat that matters most first. {touchMode ? "Tap a stat to preview, tap again to roll." : "Hover a stat to preview, click to roll."}
        </p>
      )}
      {method && (
        <div class="stat-picks">
          {STATS.map((s) => (
            <button
              key={s}
              type="button"
              class={preview === s ? "chip on" : "chip"}
              disabled={rolled.has(s)}
              onPointerDown={(e) => {
                pointer.current = e.pointerType;
                setTouchMode(e.pointerType !== "mouse");
              }}
              onPointerEnter={(e) => e.pointerType === "mouse" && setPreview(s)}
              onPointerLeave={(e) => e.pointerType === "mouse" && setPreview(null)}
              onClick={() => onStat(s)}
            >
              {s}
            </button>
          ))}
        </div>
      )}
      {method && preview && <StatPreview stat={preview} pick={pick} mod={mods[preview]} />}

      <table class="rolls">
        <thead>
          <tr>
            <th>Stat</th>
            <th>Dice</th>
            <th>Rolled</th>
            <th>Racial</th>
            <th>Score</th>
          </tr>
        </thead>
        <tbody>
          {draft.rolls.map((r) => {
            const raw = r.total + mods[r.stat];
            const score = final ? final[r.stat] : Math.max(6, Math.min(18, raw));
            return (
              <tr key={r.stat}>
                <th scope="row">{r.stat}</th>
                <td>
                  {r.method}: <DiceFaces roll={r} />
                </td>
                <td>{r.total}</td>
                <td>{mods[r.stat] ? sign(mods[r.stat]) : ""}</td>
                <td>
                  <strong>{score}</strong>
                  {raw !== score && <span class="note"> (held to {score})</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {draft.rolls.length > 0 && (
        <div class="actions">
          <button type="button" onClick={() => update({ rolls: [] })}>
            Reroll all
          </button>
        </div>
      )}
    </>
  );
}

function DiceFaces({ roll }: { roll: { dice: number[]; kept: number[] } }) {
  const kept = [...roll.kept];
  return (
    <span class="dice">
      {roll.dice.map((d, i) => {
        const k = kept.indexOf(d);
        const isKept = k >= 0;
        if (isKept) kept.splice(k, 1);
        return (
          <span key={i} class={isKept ? "die kept" : "die"}>
            {d}
          </span>
        );
      })}
    </span>
  );
}

function StatPreview({ stat, pick, mod }: { stat: Stat; pick: number; mod: number }) {
  const expected = EXPECTED_ROLL[pick]!;
  const waste = capWasteChance(pick, mod);
  return (
    <div class="preview" role="status">
      {stat}: {ROLL_METHODS[pick]!.label}
      {mod ? ` ${sign(mod)} racial` : ""}, expected {Math.min(18, Math.max(6, expected + mod)).toFixed(1)}
      {waste > 0.04 && <div class="warn">About {Math.round(waste * 100)}% of rolls would lose some of the {sign(mod)} racial bonus at the 18 cap.</div>}
    </div>
  );
}

function ClassStep({ draft, update }: StepProps) {
  const combos = draft.race ? multiclassOptions(draft.race) : [];
  const chosen = classesLabel(draft.classes);
  return (
    <>
      <div class="chips" role="group" aria-label="Single class or multiclass">
        <button type="button" class={!draft.multiclass ? "chip on" : "chip"} aria-pressed={!draft.multiclass} onClick={() => update((d) => withMulticlass(d, false))}>
          Single class
        </button>
        <button type="button" class={draft.multiclass ? "chip on" : "chip"} aria-pressed={draft.multiclass} disabled={combos.length === 0} onClick={() => update((d) => withMulticlass(d, true))}>
          Multiclass
        </button>
      </div>
      {draft.multiclass ? (
        <>
          <p class="hint">
            Combinations a {draft.race} can take (Classes v4). XP is split equally between the classes; the character uses the best attack bonus and saves of their classes.
          </p>
          <div class="chips">
            {combos.map((combo) => {
              const label = classesLabel(combo);
              return (
                <button key={label} type="button" class={chosen === label ? "chip on" : "chip"} aria-pressed={chosen === label} onClick={() => update((d) => withClasses(d, combo))}>
                  {label}
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <div class="chips">
          {CLASS_NAMES.map((c) => (
            <button key={c} type="button" class={chosen === c ? "chip on" : "chip"} aria-pressed={chosen === c} onClick={() => update((d) => withClass(d, c))}>
              {c}
            </button>
          ))}
        </div>
      )}
      {draft.classes.map((c) => (
        <ClassDetails key={c} cls={c} multiclass={draft.classes.length > 1} />
      ))}
      {draft.classes.includes("Fighter") && (
        <fieldset class="field">
          <legend>Weapon Specialization: +2 damage to</legend>
          <div class="chips">
            {(["melee", "ranged"] as const).map((s) => (
              <button key={s} type="button" class={draft.specialization === s ? "chip on" : "chip"} aria-pressed={draft.specialization === s} onClick={() => update({ specialization: s })}>
                {s === "melee" ? "Melee attacks" : "Ranged attacks"}
              </button>
            ))}
          </div>
        </fieldset>
      )}
    </>
  );
}

function ClassDetails({ cls, multiclass }: { cls: ClassName; multiclass: boolean }) {
  const rules = classes[cls];
  const restriction = (multiclassRules.restrictions as Record<string, string>)[cls];
  return (
    <>
      {multiclass && <h3>{cls}</h3>}
      <dl class="details">
        <dt>Armour</dt>
        <dd>{rules.armour}</dd>
        <dt>Weapons</dt>
        <dd>{rules.weapons}</dd>
        <dt>Hit die</dt>
        <dd>d{hitDie(cls)}</dd>
        <dt>Experiences</dt>
        <dd>{rules.experiences.docText}</dd>
        <dt>Level 1</dt>
        <dd>
          <ul>
            {abilitiesUpTo(cls, 1).map((a) => (
              <li key={a.text}>{a.text}</li>
            ))}
          </ul>
        </dd>
        {multiclass && restriction && (
          <>
            <dt>Multiclassed</dt>
            <dd>{restriction}</dd>
          </>
        )}
      </dl>
    </>
  );
}

function ExperiencesStep({ draft, update }: StepProps) {
  const [custom, setCustom] = useState("");
  const { fixed, free } = experienceSlots(draft);
  const left = free - draft.experiences.length;
  const toggle = (e: string) =>
    update((d) =>
      d.experiences.includes(e)
        ? { ...d, experiences: d.experiences.filter((x) => x !== e), expertise: d.expertise.filter((x) => x !== e) }
        : d.experiences.length < free
          ? { ...d, experiences: [...d.experiences, e] }
          : d,
    );
  const nExpertise = expertiseCount(draft);
  // Core skills first, then examples: the Default Examples plus a few random entries, or a random
  // mix from every section after Randomize (Expanded Experiences doc).
  const core = coreSkillOptions(fixed);
  const [examples, setExamples] = useState(() => startingExamples(fixed));
  const listed = [...core, ...examples];
  const customs = draft.experiences.filter((e) => !listed.includes(e));
  const chip = (e: string) => {
    const on = draft.experiences.includes(e);
    return (
      <button key={e} type="button" class={on ? "chip on" : "chip"} aria-pressed={on} disabled={!on && left <= 0} onClick={() => toggle(e)}>
        {e}
      </button>
    );
  };
  const addCustom = () => {
    const value = custom.trim();
    if (!value || left <= 0 || draft.experiences.some((e) => e.toLowerCase() === value.toLowerCase()) || fixed.some((e) => e.toLowerCase() === value.toLowerCase())) return;
    update((d) => ({ ...d, experiences: [...d.experiences, value] }));
    setCustom("");
  };
  return (
    <>
      <p class="hint">
        Choose {free}: {left} left. Pick from the lists or write your own.
      </p>
      {fixed.length > 0 && (
        <>
          <h3>Already yours</h3>
          <div class="chips">
            {fixed.map((e) => (
              <span key={e} class="chip on static">
                {e}
              </span>
            ))}
          </div>
        </>
      )}
      {customs.length > 0 && (
        <>
          <h3>Your picks</h3>
          <div class="chips">
            {customs.map((e) => (
              <button key={e} type="button" class="chip on" onClick={() => toggle(e)} aria-label={`Remove ${e}`}>
                {e} (remove)
              </button>
            ))}
          </div>
        </>
      )}
      <h3>Core skills</h3>
      <div class="chips">{core.map(chip)}</div>
      <div class="heading-row">
        <h3>Examples</h3>
        <button type="button" onClick={() => setExamples(randomExamples(fixed))}>
          Randomize
        </button>
      </div>
      <div class="chips">{examples.map(chip)}</div>
      <h3>Or write your own</h3>
      <div class="inline">
        <input type="text" value={custom} placeholder="For example Sailor" onInput={(e) => setCustom((e.target as HTMLInputElement).value)} onKeyDown={(e) => e.key === "Enter" && addCustom()} />
        <button type="button" disabled={left <= 0 || !custom.trim()} onClick={addCustom}>
          Add
        </button>
      </div>
      {nExpertise > 0 && (
        <>
          <h3>
            Expertise: double the bonus for {nExpertise} ({nExpertise - draft.expertise.length} left)
          </h3>
          <div class="chips">
            {expertiseChoices(draft).map((e) => {
              const on = draft.expertise.includes(e);
              return (
                <button
                  key={e}
                  type="button"
                  class={on ? "chip on" : "chip"}
                  aria-pressed={on}
                  disabled={!on && draft.expertise.length >= nExpertise}
                  onClick={() => update((d) => ({ ...d, expertise: on ? d.expertise.filter((x) => x !== e) : [...d.expertise, e] }))}
                >
                  {e}
                </button>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}

function EquipmentStep({ draft, update }: StepProps) {
  const cls = draft.equipmentClass;
  const picker = draft.classes.length > 1 && (
    <fieldset class="field">
      <legend>Take starting equipment from</legend>
      <div class="chips">
        {draft.classes.map((c) => (
          <button key={c} type="button" class={cls === c ? "chip on" : "chip"} aria-pressed={cls === c} onClick={() => update((d) => withEquipmentClass(d, c))}>
            {c}
          </button>
        ))}
      </div>
    </fieldset>
  );
  if (!cls) return <>{picker}</>;
  const opts = optionsFor(cls);
  const str = scores(draft)?.STR ?? 0;
  const choose = (which: "one" | "two", option: string) =>
    update((d) => {
      const picks = Object.fromEntries(Object.entries(d.slotPicks).filter(([k]) => !k.startsWith(`${which}:`)));
      return which === "one" ? { ...d, choiceOne: option, slotPicks: picks } : { ...d, choiceTwo: option, slotPicks: picks };
    });
  const group = (which: "one" | "two", label: string, list: string[], value: string | null) =>
    list.length > 0 && (
      <fieldset class="field">
        <legend>{label}</legend>
        {list.map((o) => {
          const ok = optionAvailable(o, str, draft.classes);
          const why = ok ? "" : optionAvailable(o, str) ? `Armour not allowed for ${draft.classes.join(" / ")}` : "Needs more STR for the armour";
          return (
            <label key={o} class={ok ? "option" : "option disabled"}>
              <input type="radio" name={`choice-${which}`} checked={value === o} disabled={!ok} onChange={() => choose(which, o)} />
              <span>{o}</span>
              {!ok && <span class="note"> {why}</span>}
            </label>
          );
        })}
        {slotsWithKeys(which, value).map(({ key, slot }) => (
          <SlotPicker key={key} slot={slot} picks={draft.slotPicks[key] ?? []} str={str} classes={draft.classes} onChange={(p) => update((d) => ({ ...d, slotPicks: { ...d.slotPicks, [key]: p } }))} />
        ))}
      </fieldset>
    );

  return (
    <>
      {picker}
      {group("one", "Choice One", opts.choiceOne, draft.choiceOne)}
      {group("two", "Choice Two", opts.choiceTwo, draft.choiceTwo)}
      <fieldset class="field">
        <legend>Starting gold ({decisions.startingGold.dice} {decisions.startingGold.unit})</legend>
        {draft.gold ? (
          <p>
            Rolled {draft.gold.rolls.join(" + ")} = <strong>{draft.gold.total} gp</strong>
          </p>
        ) : (
          <button type="button" onClick={() => update({ gold: rollTotal(decisions.startingGold.dice) })}>
            Roll {decisions.startingGold.dice}
          </button>
        )}
      </fieldset>
    </>
  );
}

function SlotPicker({ slot, picks, str, classes, onChange }: { slot: Slot; picks: string[]; str: number; classes: ClassName[]; onChange: (p: string[]) => void }) {
  if (slot.kind === "shield") return <p class="slot">Shield</p>;
  if (slot.kind === "weapon") return <p class="slot">{slot.count > 1 ? `${slot.count} x ${slot.name}` : slot.name}</p>;
  if (slot.kind === "armour") {
    if (slot.options.length === 1) {
      const a = armourByName(slot.options[0]!);
      return (
        <p class="slot">
          {a.name} (AC {a.acText}
          {a.strReq ? `, Str ${a.strReq}` : ""})
        </p>
      );
    }
    return (
      <div class="slot">
        Armour:{" "}
        <select value={picks[0] ?? ""} onChange={(e) => onChange([(e.target as HTMLSelectElement).value])}>
          <option value="" disabled>
            Choose armour
          </option>
          {slot.options.map((o) => (
            <option key={o} value={o} disabled={!armourChoosable(o, str, classes)}>
              {o} (AC {armourByName(o).acText})
            </option>
          ))}
        </select>
      </div>
    );
  }
  const list = weaponsFor(slot.filter);
  return (
    <div class="slot">
      {Array.from({ length: slot.count }, (_, i) => (
        <select
          key={i}
          aria-label={`${WEAPON_FILTERS[slot.filter].label} ${i + 1}`}
          value={picks[i] ?? ""}
          onChange={(e) => {
            const next = [...picks];
            next[i] = (e.target as HTMLSelectElement).value;
            onChange(next.filter(Boolean).length === slot.count ? next : next.slice(0, Math.max(i + 1, picks.length)));
          }}
        >
          <option value="" disabled>
            Choose a {WEAPON_FILTERS[slot.filter].label}
          </option>
          {list.map((w) => (
            <option key={w.name} value={w.name}>
              {w.name} ({w.damage ?? "TBD"}
              {w.traits.length ? `, ${w.traits.join(", ")}` : ""})
            </option>
          ))}
        </select>
      ))}
    </div>
  );
}

function SpellsStep({ draft, update }: StepProps) {
  const nKnown = knownSpellCount(draft);
  const toggleCantrip = (cls: ClassName, max: number, name: string) =>
    update((d) => {
      const list = d.cantrips[cls] ?? [];
      const next = list.includes(name) ? list.filter((x) => x !== name) : list.length < max ? [...list, name] : list;
      return { ...d, cantrips: { ...d.cantrips, [cls]: next } };
    });
  const toggleKnown = (name: string) =>
    update((d) => ({
      ...d,
      knownSpells: d.knownSpells.includes(name) ? d.knownSpells.filter((x) => x !== name) : d.knownSpells.length < nKnown ? [...d.knownSpells, name] : d.knownSpells,
    }));
  return (
    <>
      {creationCasters(draft).map((cls) => {
        const nCantrips = cantripCount(cls);
        const mine = draft.cantrips[cls] ?? [];
        return (
          <div key={cls}>
            {nCantrips > 0 && (
              <>
                <h3>
                  {cls} cantrips: choose {nCantrips} ({nCantrips - mine.length} left)
                </h3>
                <div class="chips">
                  {cantripList(cls).map((s) => {
                    const on = mine.includes(s);
                    return <SpellChip key={s} name={s} on={on} disabled={!on && mine.length >= nCantrips} onClick={() => toggleCantrip(cls, nCantrips, s)} />;
                  })}
                </div>
              </>
            )}
            {cls === "Wizard" ? (
              <>
                <h3>
                  Spellbook: choose {nKnown} ({nKnown - draft.knownSpells.length} left)
                </h3>
                <p class="hint">A Wizard knows as many spells as their INT Languages at 1st level, of any level they can cast.</p>
                {knowableSpellLevels(cls, 1).map((lvl) => (
                  <div key={lvl}>
                    <h4>Level {lvl}</h4>
                    <div class="chips">
                      {spellList(cls, lvl).map((s) => {
                        const on = draft.knownSpells.includes(s);
                        return <SpellChip key={s} name={s} on={on} disabled={!on && draft.knownSpells.length >= nKnown} onClick={() => toggleKnown(s)} />;
                      })}
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <p class="hint">{cls}s prepare spells from their full list during play.</p>
            )}
          </div>
        );
      })}
    </>
  );
}

function DoneStep({ draft, onNew, onFinish }: { draft: Draft; onNew: () => void; onFinish: (c: Character) => void }) {
  const [status, setStatus] = useState<string>("");
  const finish = async () => {
    try {
      const c = toCharacter(draft);
      await saveCharacter(c);
      onFinish(c);
    } catch (e) {
      setStatus(`Could not save: ${e instanceof Error ? e.message : String(e)}`);
    }
  };
  return (
    <>
      <p class="hint">
        {draft.name} is ready: {draft.race} {classesLabel(draft.classes)}, level 1. Save the character to your library and open the sheet to play.
      </p>
      <div class="actions">
        <button type="button" class="primary" onClick={finish}>
          Save and open sheet
        </button>
        <button type="button" onClick={onNew}>
          Start again
        </button>
      </div>
      {status && (
        <p class="status" role="status">
          {status}
        </p>
      )}
    </>
  );
}
