import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { Character } from "../model/character";
import { saveCharacterFileAs, writeCharacterFile, type FilePath } from "../storage";
import { sheetFor } from "./derived";
import { Page1 } from "./Page1";
import { Page2 } from "./Page2";
import "./sheet.css";

const AUTOSAVE_MS = 600;

/**
 * The playable sheet. In the desktop app every change is written back to the character's
 * file shortly after it is made. In a browser there is no file to write to, so the player saves.
 */
export function Sheet({ initial, path: initialPath, onClose }: { initial: Character; path: FilePath; onClose: () => void }) {
  const [c, setC] = useState(initial);
  const [path, setPath] = useState<FilePath>(initialPath);
  const [status, setStatus] = useState(initialPath ? "Saved" : "");
  const [dirty, setDirty] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const view = useMemo(() => sheetFor(c), [c]);

  const update = (fn: (c: Character) => Character) => {
    setC(fn);
    setDirty(true);
  };

  useEffect(() => {
    if (!dirty || !path) return;
    setStatus("Saving...");
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      writeCharacterFile(path, c)
        .then(() => {
          setDirty(false);
          setStatus("Saved");
        })
        .catch((e) => setStatus(`Could not save: ${e instanceof Error ? e.message : String(e)}`));
    }, AUTOSAVE_MS);
    return () => window.clearTimeout(timer.current);
  }, [c, dirty, path]);

  const saveAs = async () => {
    try {
      const saved = await saveCharacterFileAs(c);
      if (!saved) return;
      setPath(saved.path);
      setDirty(false);
      setStatus(saved.path ? "Saved" : `Downloaded ${saved.label}`);
    } catch (e) {
      setStatus(`Could not save: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const close = () => {
    if (dirty && !path && !window.confirm("This character has changes that are not saved. Close anyway?")) return;
    onClose();
  };

  return (
    <div class="sheet-screen">
      <div class="toolbar">
        <button type="button" onClick={close}>
          Close
        </button>
        <span class="file" title={path ?? ""}>
          {path ? path.split(/[\\/]/).pop() : "Not saved to a file"}
        </span>
        <span class="save-status" role="status">
          {!path && dirty ? "Unsaved changes" : status}
        </span>
        <button type="button" class={!path && dirty ? "primary" : ""} onClick={saveAs}>
          {path ? "Save as" : "Save"}
        </button>
      </div>
      <div class="pages">
        <Page1 c={c} view={view} update={update} />
        {view.spellcasting && <Page2 c={c} view={view} update={update} />}
      </div>
    </div>
  );
}
