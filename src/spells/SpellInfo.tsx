// The spell card: the Spell Compendium text for a spell, shown beside it. On a desktop it opens
// when the pointer rests on a spell; on a touch screen, when a spell is pressed and held (a tap
// still ticks or picks it). One card is shared by the whole app.
import { createContext, type ComponentChildren, type JSX } from "preact";
import { useContext, useEffect, useRef, useState } from "preact/hooks";
import { spellTexts } from "../rules";

type Shown = { name: string; el: Element } | null;
const Ctx = createContext<{ show: (name: string, el: Element) => void; hide: () => void }>({ show: () => undefined, hide: () => undefined });

const HOVER_MS = 250;
const HOLD_MS = 450;

/** "**bold** and *italic*" to elements. */
function Rich({ text }: { text: string }) {
  const parts: (string | JSX.Element)[] = [];
  const re = /\*\*(.+?)\*\*|\*(.+?)\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(m[1] !== undefined ? <strong key={m.index}>{m[1]}</strong> : <em key={m.index}>{m[2]}</em>);
    last = re.lastIndex;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

/** "3rd" from a spell level number, for labels in pickers. */
export const levelLabel = (name: string) => spellTexts[name]?.level ?? "";

export function SpellCard({ name }: { name: string }) {
  const s = spellTexts[name];
  if (!s) return <div class="spell-card-body">No text for {name} in the Spell Compendium.</div>;
  return (
    <div class="spell-card-body">
      <div class="spell-card-title">{name}</div>
      <div class="spell-card-meta">
        {s.level} • {s.school}
        {s.duration ? ` • ${s.duration}` : ""}
      </div>
      {s.text.split("\n").map((p, i) => (
        <p key={i}>
          <Rich text={p} />
        </p>
      ))}
    </div>
  );
}

export function SpellInfoProvider({ children }: { children: ComponentChildren }) {
  const [shown, setShown] = useState<Shown>(null);
  const [, setTick] = useState(0);
  const api = useRef({
    show: (name: string, el: Element) => setShown({ name, el }),
    hide: () => setShown(null),
  }).current;

  // The card stays until the pointer leaves the spell (desktop), or a tap elsewhere or Escape.
  // Scrolling moves it with its spell rather than closing it.
  useEffect(() => {
    if (!shown) return;
    const close = () => setShown(null);
    const follow = () => (shown.el.isConnected ? setTick((n) => n + 1) : close());
    const key = (e: KeyboardEvent) => e.key === "Escape" && close();
    const tap = (e: PointerEvent) => e.pointerType !== "mouse" && close();
    window.addEventListener("scroll", follow, true);
    window.addEventListener("resize", follow);
    window.addEventListener("keydown", key);
    const t = window.setTimeout(() => window.addEventListener("pointerdown", tap), 0);
    return () => {
      window.removeEventListener("scroll", follow, true);
      window.removeEventListener("resize", follow);
      window.removeEventListener("keydown", key);
      window.removeEventListener("pointerdown", tap);
      window.clearTimeout(t);
    };
  }, [shown]);

  let style = "";
  if (shown) {
    const rect = shown.el.getBoundingClientRect();
    const w = Math.min(360, window.innerWidth - 16);
    const right = rect.right + 8;
    const left = right + w <= window.innerWidth - 8 ? right : Math.max(8, rect.left - w - 8);
    const top = Math.min(Math.max(8, rect.top - 8), Math.max(8, window.innerHeight - 320));
    style = `left:${left}px;top:${top}px;width:${w}px`;
  }
  return (
    <Ctx.Provider value={api}>
      {children}
      {shown && (
        <div class="spell-card" role="tooltip" style={style}>
          <SpellCard name={shown.name} />
        </div>
      )}
    </Ctx.Provider>
  );
}

/**
 * Event handlers that open the spell card for a spell: hover on a desktop, press and hold on a
 * touch screen. After a hold, the tap that would follow is swallowed so it does not tick the spell.
 */
export function useSpellInfo(name: string) {
  const { show, hide } = useContext(Ctx);
  const timer = useRef<number | undefined>(undefined);
  const held = useRef(false);
  const clear = () => window.clearTimeout(timer.current);
  return {
    onPointerEnter: (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const el = e.currentTarget as Element;
      clear();
      timer.current = window.setTimeout(() => show(name, el), HOVER_MS);
    },
    onPointerLeave: (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      clear();
      hide();
    },
    onPointerDown: (e: PointerEvent) => {
      if (e.pointerType === "mouse") return;
      held.current = false;
      const el = e.currentTarget as Element;
      clear();
      timer.current = window.setTimeout(() => {
        held.current = true;
        show(name, el);
      }, HOLD_MS);
    },
    onPointerUp: () => clear(),
    onPointerCancel: () => clear(),
    onContextMenu: (e: Event) => e.preventDefault(),
    onClickCapture: (e: Event) => {
      if (held.current) {
        e.preventDefault();
        e.stopPropagation();
        held.current = false;
      }
    },
  };
}

/** A spell to pick: its name and level; hovering it (or holding it on a touch screen) shows the spell card. */
export function SpellChip({ name, label = name, on, disabled, onClick }: { name: string; label?: string; on: boolean; disabled?: boolean; onClick: () => void }) {
  const info = useSpellInfo(name);
  const level = levelLabel(name);
  return (
    <button type="button" class={on ? "chip on" : "chip"} aria-pressed={on} disabled={disabled} onClick={onClick} {...info}>
      {label}
      {level && <span class="spell-level">{level === "Cantrip" ? "cantrip" : level}</span>}
    </button>
  );
}
