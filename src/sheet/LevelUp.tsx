// Gaining a level, from the sheet's toolbar. Shows what the new level gives and asks for the
// HP roll and any picks (cantrips, a Wizard spell, Thief Expertise, Bard Magical Secrets).
import { useState } from "preact/hooks";
import { attackBonus, spellSlots, type ClassName } from "../rules";
import { rollDie } from "../engine/dice";
import { conHp, statBonuses } from "../engine/derive";
import {
  applyLevelUp,
  cantripOptions,
  choicesFor,
  expertiseOptions,
  hpGain,
  secretOptions,
  wizardSpellOptions,
} from "../engine/levels";
import type { Character, SecretSpell } from "../model/character";
import { allExperiences, characterScores } from "./derived";

const sign = (n: number) => (n > 0 ? `+${n}` : `${n}`);

export function LevelUpPanel({ c, ready, onApply, onCancel }: { c: Character; ready: number[]; onApply: (c: Character) => void; onCancel: () => void }) {
  const [index, setIndex] = useState<number>(ready[0]!);
  return (
    <div class="overlay" role="dialog" aria-modal="true" aria-labelledby="levelup-title">
      <div class="panel">
        <h2 id="levelup-title">Level up</h2>
        {ready.length > 1 && (
          <div class="chips" role="group" aria-label="Class to level">
            {ready.map((i) => (
              <button key={i} type="button" class={i === index ? "chip on" : "chip"} aria-pressed={i === index} onClick={() => setIndex(i)}>
                {c.classes[i]} {(c.levels[i] ?? 1) + 1}
              </button>
            ))}
          </div>
        )}
        <LevelUpForm key={index} c={c} index={index} onApply={onApply} onCancel={onCancel} />
      </div>
    </div>
  );
}

function Picker<T>({ label, count, options, chosen, name, onChange }: { label: string; count: number; options: T[]; chosen: T[]; name: (o: T) => string; onChange: (v: T[]) => void }) {
  if (count === 0) return null;
  return (
    <fieldset class="field">
      <legend>
        {label}: choose {count} ({count - chosen.length} left)
      </legend>
      <div class="chips pick-list">
        {options.map((o) => {
          const on = chosen.some((x) => name(x) === name(o));
          return (
            <button
              key={name(o)}
              type="button"
              class={on ? "chip on" : "chip"}
              aria-pressed={on}
              disabled={!on && chosen.length >= count}
              onClick={() => onChange(on ? chosen.filter((x) => name(x) !== name(o)) : [...chosen, o])}
            >
              {name(o)}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function LevelUpForm({ c, index, onApply, onCancel }: { c: Character; index: number; onApply: (c: Character) => void; onCancel: () => void }) {
  const ch = choicesFor(c, index);
  const cls: ClassName = ch.cls;
  const bonuses = statBonuses(characterScores(c));
  const [rollText, setRollText] = useState("");
  const [cantrips, setCantrips] = useState<string[]>([]);
  const [known, setKnown] = useState<string[]>([]);
  const [expertise, setExpertise] = useState<string[]>([]);
  const [secrets, setSecrets] = useState<SecretSpell[]>([]);

  const roll = ch.hp.kind === "roll" ? Number.parseInt(rollText, 10) : null;
  const rollValid = ch.hp.kind === "flat" || (roll !== null && roll >= 1 && roll <= ch.hp.die);
  const gain = rollValid ? hpGain(cls, ch.hp, ch.hp.kind === "roll" ? roll : null, c.classes.length, bonuses) : null;
  const complete =
    rollValid && cantrips.length === ch.cantrips && known.length === ch.knownSpells && expertise.length === Math.min(ch.expertise, expertiseOptions(allExperiences(c), c).length) && secrets.length === ch.magicalSecrets;

  const oldLevel = ch.newLevel - 1;
  const atkBefore = attackBonus(cls, oldLevel);
  const atkAfter = attackBonus(cls, ch.newLevel);
  const slotsBefore = spellSlots(cls, oldLevel).join(" / ");
  const slotsAfter = spellSlots(cls, ch.newLevel).join(" / ");
  const share = c.classes.length > 1 ? `, divided by ${c.classes.length} classes` : "";

  return (
    <>
      <h3>
        {cls} {ch.newLevel}
      </h3>
      <fieldset class="field">
        <legend>Hit points</legend>
        {ch.hp.kind === "roll" ? (
          <div class="inline">
            <input
              type="text"
              inputMode="numeric"
              aria-label={`d${ch.hp.die} roll`}
              placeholder={`d${ch.hp.die} roll`}
              value={rollText}
              onInput={(e) => setRollText((e.target as HTMLInputElement).value.trim())}
            />
            <button type="button" onClick={() => setRollText(String(rollDie(ch.hp.kind === "roll" ? ch.hp.die : 1)))}>
              Roll d{ch.hp.die}
            </button>
          </div>
        ) : (
          <p>The HP column adds {ch.hp.amount} at this level (no CON).</p>
        )}
        <p class="hint">
          {gain === null
            ? `Roll, or type a roll from 1 to ${ch.hp.kind === "roll" ? ch.hp.die : ""}.`
            : ch.hp.kind === "roll"
              ? `+${gain} HP: roll ${roll} + CON ${sign(conHp(cls, bonuses))}${share}, at least 1.`
              : `+${gain} HP${share}, at least 1.`}
        </p>
      </fieldset>

      {(ch.newAbilities.length > 0 || atkAfter !== atkBefore || slotsAfter !== slotsBefore) && (
        <dl class="details">
          {ch.newAbilities.length > 0 && (
            <>
              <dt>New</dt>
              <dd>
                <ul>
                  {ch.newAbilities.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </dd>
            </>
          )}
          {atkAfter !== atkBefore && (
            <>
              <dt>Attack Bonus</dt>
              <dd>
                {sign(atkBefore)} to {sign(atkAfter)}
              </dd>
            </>
          )}
          {slotsAfter !== slotsBefore && (
            <>
              <dt>Spell slots</dt>
              <dd>
                {slotsBefore || "none"} to {slotsAfter}
              </dd>
            </>
          )}
        </dl>
      )}

      <Picker label="New cantrip" count={ch.cantrips} options={cantripOptions(c, cls)} chosen={cantrips} name={(s) => s} onChange={setCantrips} />
      <Picker label="New spell for the spellbook" count={ch.knownSpells} options={wizardSpellOptions(c, ch.newLevel)} chosen={known} name={(s) => s} onChange={setKnown} />
      <Picker
        label="Expertise (double the bonus)"
        count={Math.min(ch.expertise, expertiseOptions(allExperiences(c), c).length)}
        options={expertiseOptions(allExperiences(c), c)}
        chosen={expertise}
        name={(s) => s}
        onChange={setExpertise}
      />
      <Picker label="Magical Secrets (any spell from any class)" count={ch.magicalSecrets} options={secretOptions(c)} chosen={secrets} name={(s) => `${s.spell} (${s.from})`} onChange={setSecrets} />

      <div class="actions">
        <button
          type="button"
          class="primary"
          disabled={!complete}
          onClick={() => onApply(applyLevelUp(c, index, { roll: ch.hp.kind === "roll" ? roll : null, hpGain: gain ?? 0, cantrips, knownSpells: known, expertise, magicalSecrets: secrets }))}
        >
          Gain level {ch.newLevel}
        </button>
        <button type="button" onClick={onCancel}>
          Not now
        </button>
      </div>
    </>
  );
}
