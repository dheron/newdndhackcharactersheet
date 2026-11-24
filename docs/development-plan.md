# Development plan: desktop app (Mac and Windows), character creation first

Purpose order: character creation first, then the sheet, then printing. iPad and iPhone come later from the same code.

## Sources

- Rules: the Drive docs listed in `CLAUDE.md` (re-read before each phase).
- Behaviour baseline: David's original app (`legacy/dnd-character-generator.html`). Its creation flow and formulas are the design; its data tables are replaced by the current docs.

## Character creation flow

| Step | What the player does | Source |
|---|---|---|
| 1. Name and race | Pick a race. Human and Half-Elf choose two stats for +1 each. | Races |
| 2. Ability scores | Pick a stat, then roll for it. Dice by pick order: 7d6, 6d6, 5d6, 4d6 keep top 3, then 3d6, then 2d6 twice keep higher. Racial modifiers apply after rolling, then each score is held to 6 to 18. Show the dice, expected result and a short text warning when a positive racial bonus may be wasted at 18. Desktop: hover previews, click confirms. Touch: tap selects, tap again confirms. | Original app |
| 3. Class | Pick a class. Multiclass combinations are offered by race; each class gets its own sheet. | Classes v4 |
| 4. Experiences | Fixed Experiences for the class, free picks up to the class count, plus racial bonus Experiences. Pick from the list or write your own. Paladin and Wizard choose freely (no count in the doc). | Classes v4, Races, Experiences |
| 5. Equipment | Choose Choice One and Choice Two from the class's Starting Equipment options. Where an option names a category ("Two-Handed Martial Melee", "any Druid weapon"), pick the weapon from the Weapons sheet. | Weapons and Armour |
| 6. Spells (casters) | Pick cantrips (counts in Classes v4). Wizards also pick their starting spellbook. Other casters prepare from their full list. | Classes v4, Spell Books |
| 7. Sheet | The app works out everything below, shows the approved sheet, saves the character and can print it. | All |

Completed steps collapse into summary cards above the current step; clicking one returns to edit it. Changing an earlier step recalculates everything after it (the original app kept stale racial bonuses when race changed; fixed here).

### Formulas (from the original app, checked against the docs)

- Level 1 HP: maximum of the class hit die (Classes v4 HP column) plus the CON HP bonus (warrior column for Fighter, Barbarian, Paladin, Ranger). Barbarian doubles the CON bonus.
- AC: armour base AC + DEX AC Bonus (up to the armour's DEX cap) + 2 for a shield. Barbarian with no armour: 10 + double DEX AC Bonus.
- Melee: Hit Bns = class Attack Bonus + STR melee hit + magic; damage = weapon die + STR damage bonus.
- Ranged: Hit Bns = class Attack Bonus + DEX ranged hit + magic; damage = weapon die.
- Saves: class targets from Saving Throws; DEX bonus on Blast / Barrage; WIS bonus only against spells that attack the mind; racial situational bonuses on the note lines.

## Proposed defaults (David to confirm)

1. Wizard starting spellbook: cantrips per the class table plus 6 first-level spells, chosen at creation.
2. Starting money: none. Starting Equipment options cover gear, and treasure counts as XP.
3. Armour Strength requirement: warn, do not block.
4. Name differences between the Starting Equipment options and the tables are matched ("Chain Mail" = "Chain / Banded Mail", "Light Cross" = "Light Crossbow", "Longsword" = "Long Sword", "Shortsword" = "Short Sword", "Learther" = "Leather").
5. Missing values (Club damage, Great Axe cost, Dart type) show as blank and are listed in the rules report.

## Technology

- TypeScript, Vite, Preact for the UI; Vitest for rules tests; Playwright for screen and print checks.
- Tauri 2 for the Mac and Windows app (small installers; same code can target iPad and iPhone later). Risk: printing can differ between Mac and Windows web engines; test early, and generate the PDF in the app if needed.
- Rules as JSON data, each value tagged with its source doc.
- One JSON file per character, with a format version.
- GitHub Actions: checks on every change, Mac and Windows builds to download.

## Phases

| # | Deliverable | David reviews |
|---|---|---|
| 0 | App skeleton, checks, Mac and Windows builds | Installs the blank app |
| 1 | Rules data needed for creation, with a generated report of every value and its source | The report against the docs |
| 2 | Character creation flow (steps 1 to 7), saving a character file | Creates one character of each class |
| 3 | The sheet on screen, page 1 and caster page 2, with play tracking (HP, slots, prepared spells, inventory, notes) | Plays a session from it |
| 4 | Printing to US Letter and PDF, matching the approved wireframes | Prints the sheets |
| 5 | Character list (open, duplicate, delete) and installers | |
| Later | Levelling up; iPad and iPhone | |
