# Character sheet app (homebrew 5e / AD&D 2e hybrid)

A playable character sheet, not just a generator. Players create characters, save and load several of them, play from the sheet on phone, iPad or desktop, and print it on US Letter. The owner is David, a professional game designer.

## Working rules

- **Check with David before writing code.** Propose first, build after approval.
- **David's Google Drive docs are the only source of truth.** Copy rules, names and numbers exactly. Do not add abilities, items, fields or numbers that are not in them. If something is needed and not in the docs, ask; if a placeholder is unavoidable, show it as blank or "TBD", never a guess.
- **Re-read the docs before relying on them.** They change. Do not copy rules tables into this file or other notes; point to the doc instead. (The previous CLAUDE.md drifted from the docs and caused errors.)
- If a number comes from memory instead of a doc, say so and flag it.
- No em dashes in any written output (UI text, docs, commit messages).
- Test on a narrow phone viewport and on iPad, not only desktop. Print layouts must fit one US Letter page each.
- Wireframes are plain greyscale boxes and labels: no colour, sample data, icons or extra screens unless asked.

## Source docs (Google Drive)

Project folder: `1p1r75V5ebopMRWvEFa_mRU6wO_asvqVv`

| Doc | ID | Use |
|---|---|---|
| High Level Goals | `10Elr36luH2lsMM6S8l5fJkhVxOkaAOGzevqPV1xnEhA` | Design intent |
| Classes v4 | `1UDB0LV9BfAtNSdZ3lAkDJWmv1Wi6RIQGlaXwbqs3rpg` | Class tables (XP, attack bonus, HP dice, slots, abilities, cantrips), multiclassing, Turn Undead |
| Ability Score Tables v4 | `12Z-sJECWgoBKFgWoIo3S7c3JgT_EjOBl5LQZU8VOHT0` | Every stat bonus, scores 3 to 24 |
| Saving Throws | `1h3buCjn4JH9Bp9pPQyw2JjjgVDxA4GILATAHaqAUlA8` | Five categories, priority, per-class targets by level |
| Races (detailed) | `1mOugghME6PHrir0T-gvva6MyXfOSbPCV1ZAxtaixT30` | Current race doc. An older summary "Races" doc (`1-XDWCxJtBoo8wYkNZSJ6EyQO8xrwKaxlc_IT5Fq0XZU`) is superseded |
| Experiences | `18hBsCFV3PQC8Mjufchcp0iFHwNlqpXYsuq8FNg1uI_M` | Experience rules and starting list |
| Ability Score Math | `1rDjJv-9zHyKNqqC2tWuxPKFoko5cSfeABJBV72Xirm0` | XP curve working sheet (not stat generation) |

Spell books folder: `1jzcVhqFq2wWfIoKf708woF2WlbKaRmQT`

| Doc | ID |
|---|---|
| Wizard Spellbook | `1SdSthbGEeDemighe05Lz_Vz8fk9LuIzHsPhB36g6EZE` |
| Cleric Spellbook | `1Sni-tUej_f-HEzB6pMtipeWwlBqlb_rGrBIJCJQNZOk` |
| Druid Spellbook | `1FF07CZ81u3EtD5UT9C0kBjEN7D5-AjNtX6WvF0ySA0U` |
| Bard Spellbook | `1REimUArqPZksDFOjT2AF9uOERn1H3EiJEN00mS1pFO4` |
| Paladin Spellbook | `10jlYu4dOidU356j4zNoRrRsv-hk8BQoZt7ctQmKj-U8` |
| Ranger Spellbook | `1ktsRQDGr9sEKXM7dhtrLk32wAmWKqobjh-jjv2EUOQk` |
| Spell Compendium | `1uvEi5cgM7sd6U6fmZQaH0iNzc_T5SdbKK1LJdmwFX0I` |
| Proposed Spell Lists (sheet) | `1ypxljYQzfPRGOkZ1LGO5s4maVQvmKJXqi8vXONDVFks` (older; the spellbooks win) |

Legacy single-file app, for reference only: `legacy/dnd-character-generator.html` (Drive `1CIW9XWqvEe9c6c_gfrByOoImygQrqT7d`). Its data tables were partly written from memory and several do not match the docs. Do not port its data.

## Design

The approved character sheet layout and the rules decisions behind it are in [`docs/character-sheet-spec.md`](docs/character-sheet-spec.md). Wireframe sources are in `design/wireframes/`.

## Development

Plan: [`docs/development-plan.md`](docs/development-plan.md).

- Stack: TypeScript, Vite, Preact; Tauri 2 desktop shell in `src-tauri/`.
- `npm run dev`: front end in a browser at http://localhost:1420.
- `npx tauri dev`: the desktop app with live reload.
- `npm run check`: typecheck, tests and front end build. Run before every commit.
- `npx tauri build`: installers for the current OS. CI (`.github/workflows/ci.yml`) builds the macOS (universal) and Windows installers and attaches them to each run.
- App icon: `app-icon.png` is a placeholder; regenerate sizes with `npx tauri icon app-icon.png`.

## Status

1. Print page 1: approved (first draft).
2. Print page 2 for spellcasters: approved for Wizard and Cleric; Druid, Bard, Paladin, Ranger drafted.
3. iPad and phone versions: in progress.
4. App build: phase 0 (app skeleton and CI) done. Next: phase 1, rules data for character creation.

Open questions are listed at the end of the spec.
