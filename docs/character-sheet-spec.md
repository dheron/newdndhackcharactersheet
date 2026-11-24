# Character sheet spec

What the sheet shows and why. Values come from the Drive docs listed in `CLAUDE.md`; this file records layout and decisions, not rules tables.

## Principles

- Heavily inspired by the AD&D 2e character record: each stat sits on the same row as what it affects.
- Simpler system, so space goes to clarity: no fields the rules do not use, no large empty boxes.
- The sheet is generated from the saved character, so printed counts (Experience lines, slot boxes) can match the character.
- One page per side, US Letter. Labels are centred above their boxes. Section headers are centred.

## Page 1 (all classes)

Top to bottom:

1. **Header row:** Name, Race, Class and level, XP, Align, Move, Atk Bns.
   - Align is one of the basic 5e alignments, written short (LG, N, CE...). Move comes from the Races doc.
   - Multiclass characters write all classes in Class and level (for example "Fighter 3 / Thief 3"). XP is one total, split equally between classes. Atk Bns is the best of their classes.
2. **Main row (five columns, same height):**
   - **Stats:** STR, DEX, CON, INT, WIS, CHA, one score box each.
   - **Stat bonuses:** on each stat's row, full-name labels on one line, boxes spread across the column.
     - STR: Melee hit, Damage
     - DEX: Ranged hit, AC, Blast save
     - CON: HP per hit die
     - INT: Languages, Spell attack, Arcane potency
     - WIS: Divine potency, Mind spell save
     - CHA: empty (no effect in the docs)
   - **HP:** Max, Current, Temp HP, Hit dice (three lines).
   - **Experiences:** 13 lines.
   - **Saving throws:** columns Type, Total, Base, BNS. BNS is every bonus that always applies (racial, and DEX on Blast / Barrage); Total = Base minus BNS, the number the d20 must reach. Rows in this order: Spell, Blast / Barrage, Petrification / Polymorph, Magic Item, Death / Paralyze. Each row has a blank note line under it for situational bonuses, plus two spare note lines at the bottom.
3. **Armour class row:** AC (total, 2 digits) = Armour (name) + AC + Shield + DEX + Misc, then a Note box.
4. **Melee weapons (4 rows):** Name, Hit Bns, Base, STR, Mag, Damage, Type (1 character), Note.
5. **Ranged weapons (3 rows):** Name, Range (fits NNN/NNN), Hit Bns, Base, DEX, Mag, Damage, Type, Note.
6. **Bottom (three columns):** "Abilities / Languages" over the first column; "Inventory / Notes" spanning the other two, which are separate columns (inventory, then notes). The inventory starts with the starting equipment and gold. Each weapon gets one row however many the character has.
   - Abilities lists only abilities. Rules (Expertise, bonus Experiences, ability score picks, cantrip counts, multiclass restrictions and the like) are left off; save bonus traits and the Human XP bonus stay; the list is in `decisions.json` (`notOnAbilityList`). Thieves' Cant is shown under Languages.

## Page 2 (spellcasters only)

One page per casting class. Same structure for all:

- **Header:** Name, Class and level, Spell atk = Base + (INT for Wizard) + Misc, and a potency box.
- **Level boxes** in columns, ordered top to bottom then left to right. Each box has a black title bar, then a white band with **Slots** and **Spent** tick boxes (never inside the black bar), then the spells.
- **Preparing** works like 5e: tick the box beside a spell to mark it prepared; slots are spent separately.
- Slot boxes per level are the class's maximum at that spell level, from the Classes doc.

| Class | Spells | Cantrips box | Spell atk Base | Potency | Extra |
|---|---|---|---|---|---|
| Wizard | Blank spellbook lines, more at low levels (17 at 1st down to 6 at 9th) | 5 lines | Wizard Spell Atk column | Arcane (INT) | |
| Cleric | Cleric Spellbook list printed, tick to prepare | 4 blank lines | Class Attack Bonus | Divine (WIS) | Turn Undead table |
| Druid | Druid Spellbook list printed | 4 blank lines | Class Attack Bonus | Divine (WIS) | |
| Bard | Bard Spellbook list printed (4 columns) | 4 blank lines | Class Attack Bonus | Arcane (INT) | |
| Paladin | Paladin Spellbook list printed (2 columns) | none | Class Attack Bonus | Divine (WIS) | Turn Undead table (two levels lower) |
| Ranger | Ranger Spellbook list printed (2 columns) | none | Class Attack Bonus | Divine (WIS) | |

## Rules decisions (from David)

- Multiclass characters: one page 1 showing all classes, and a page 2 for each casting class.
- Multiclass creation (David): combinations by race from Classes v4 (starred classes can be swapped as the table's key says; "Mage" is Wizard). Experiences: every fixed one from each class plus the highest free count. Starting equipment: the player picks one class's options. HP for each class level is what that class would get (hit die plus that class's own CON bonus) divided by the number of classes, rounded down, never below 1; at 1st level every class gains a level at once with the maximum hit die. Hit dice lines show one class each.
- Cantrips exist for Wizard, Cleric, Druid and Bard only (counts in the Classes doc).
- Preparing spells works like 5e. Spellbook size is not capped.
- Wizard spells known: INT Languages at 1st level, +1 spell on each level up (Classes v4).
- Cleric, Druid, Bard, Ranger and Paladin spell attack uses the class Attack Bonus from the levelling chart. Potency: Wizard and Bard arcane (INT); Cleric, Druid, Paladin and Ranger divine (WIS).
- Starting gold is 2d6 gp. Armour Strength requirements are enforced during creation.
- Ability score generation, level 1 HP and the AC and attack formulas follow David's original app (see `docs/development-plan.md`).
- WIS bonus applies only to saves against spells that attack the mind; it is not a general Spell save bonus.
- Racial save bonuses that apply only to some effects (for example +2 vs poison) are written on the save note lines.
- Turn Undead appears on the Cleric and Paladin page 2.
- Concentration is not a rule in this system.
- Alignment is the basic 5e list (David).

## On screen (phase 3)

The app shows the same pages as the print layout, with worked-out values filled in and inputs for what changes in play: XP, current and temp HP, hit dice lines 2 and 3, extra Experiences, save notes, armour, shield, AC misc and note, weapons with Mag and Note, languages, inventory and notes. Page 2 shows the slots the character has now (filled), Spent tick boxes for those, and a Prepared tick beside each spell; Wizards add spells to their spellbook from the list. In the desktop app every change is saved back to the character's file.

## Open questions

1. Save row order on page 1 (Spell first) is the reverse of the Saving Throws doc priority order. Confirm this is intended.
