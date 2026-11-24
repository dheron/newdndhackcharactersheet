import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { Character } from "../model/character";
import { saveCharacterFileAs } from "../storage";
import { saveCharacter } from "../library";
import { printSheet } from "../print";
import { sheetFor } from "./derived";
import { Page1 } from "./Page1";
import { Page2 } from "./Page2";
import "./sheet.css";

const AUTOSAVE_MS = 600;

/**
 * The playable sheet. Every change is saved to the character library shortly after it is made,
 * and any change still waiting is saved when the sheet is closed.
 */
export function Sheet({ initial, onClose }: { initial: Character; onClose: () => void }) {
  const [c, setC] = useState(initial);
  const [status, setStatus] = useState("Saved");
  const [dirty, setDirty] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const latest = useRef(c);
  latest.current = c;
  const view = useMemo(() => sheetFor(c), [c]);

  const update = (fn: (c: Character) => Character) => {
    setC(fn);
    setDirty(true);
  };

  const save = (ch: Character) =>
    saveCharacter(ch)
      .then(() => {
        setDirty(false);
        setStatus("Saved");
      })
      .catch((e) => setStatus(`Could not save: ${e instanceof Error ? e.message : String(e)}`));

  useEffect(() => {
    if (!dirty) return;
    setStatus("Saving...");
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => save(c), AUTOSAVE_MS);
    return () => window.clearTimeout(timer.current);
  }, [c, dirty]);

  const exportFile = async () => {
    try {
      const saved = await saveCharacterFileAs(c);
      if (saved) setStatus(`Exported to ${saved.label}`);
    } catch (e) {
      setStatus(`Could not export: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const close = async () => {
    window.clearTimeout(timer.current);
    if (dirty) await save(latest.current);
    onClose();
  };

  return (
    <div class="sheet-screen">
      <div class="toolbar">
        <button type="button" onClick={close}>
          Characters
        </button>
        <span class="file">{c.name}</span>
        <span class="save-status" role="status">
          {status}
        </span>
        <button type="button" onClick={exportFile}>
          Export
        </button>
        <button type="button" onClick={() => printSheet().catch((e) => setStatus(`Could not print: ${e instanceof Error ? e.message : String(e)}`))}>
          Print
        </button>
      </div>
      <div class="pages">
        <Page1 c={c} view={view} update={update} />
        {view.casters.map((caster) => (
          <Page2 key={caster.cls} c={c} caster={caster} castingOff={view.castingOff[caster.cls]} update={update} />
        ))}
      </div>
    </div>
  );
}
