// Builds src/rules/data/spells.json from sources/spell-lists.txt.
// sources/spell-lists.txt holds the "Spell List by Level" lines copied from each
// class spellbook in the Spell Books Drive folder. Re-run after updating it:
//   node scripts/import-spell-lists.mjs
import { readFileSync, writeFileSync } from "node:fs";

const SOURCES = {
  Wizard: "Wizard Spellbook (1SdSthbGEeDemighe05Lz_Vz8fk9LuIzHsPhB36g6EZE)",
  Cleric: "Cleric Spellbook (1Sni-tUej_f-HEzB6pMtipeWwlBqlb_rGrBIJCJQNZOk)",
  Druid: "Druid Spellbook (1FF07CZ81u3EtD5UT9C0kBjEN7D5-AjNtX6WvF0ySA0U)",
  Bard: "Bard Spellbook (1REimUArqPZksDFOjT2AF9uOERn1H3EiJEN00mS1pFO4)",
  Paladin: "Paladin Spellbook (10jlYu4dOidU356j4zNoRrRsv-hk8BQoZt7ctQmKj-U8)",
  Ranger: "Ranger Spellbook (1ktsRQDGr9sEKXM7dhtrLk32wAmWKqobjh-jjv2EUOQk)",
};

const text = readFileSync(new URL("../sources/spell-lists.txt", import.meta.url), "utf8");
const classes = {};
let current = null;
for (const line of text.split("\n")) {
  const heading = line.match(/^## (\w+)$/);
  if (heading) {
    current = heading[1];
    if (!SOURCES[current]) throw new Error(`No source listed for ${current}`);
    classes[current] = { source: SOURCES[current], levels: {} };
    continue;
  }
  const row = line.match(/^\*\*(Cantrips|(\d)(?:st|nd|rd|th) Level)\*\* (.+)$/);
  if (!row || !current) continue;
  const level = row[1] === "Cantrips" ? 0 : Number(row[2]);
  classes[current].levels[level] = row[3].split(" • ").map((s) => s.trim());
}

const out = { note: "Level 0 is cantrips.", classes };
writeFileSync(new URL("../src/rules/data/spells.json", import.meta.url), JSON.stringify(out, null, 2) + "\n");
console.log("Wrote src/rules/data/spells.json");
