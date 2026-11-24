// Page 2 layout for each casting class, from the approved wireframes
// (design/wireframes/page2-<class>.dc.html). Spell names and slot counts come from the rules data;
// this file only says where each box goes and how tall the rows are.
import type { ClassName } from "../rules";

/** A box on page 2: "cantrips" or a spell level. */
export type BoxId = "cantrips" | number;

export interface Page2Layout {
  /** Boxes in each column, top to bottom. */
  columns: BoxId[][];
  /** Height of one spell row, in pixels. */
  rowHeight: number;
  /** Slots and Spent on two lines (true) or one line (false). */
  twoLineSlots: boolean;
  /** Blank lines in the Cantrips box. */
  cantripLines: number;
  /** Wizard only: blank spellbook lines per spell level (index 0 = 1st level). */
  spellbookLines?: number[];
  turnUndead: boolean;
}

export const PAGE2_LAYOUT: Partial<Record<ClassName, Page2Layout>> = {
  Wizard: {
    columns: [
      ["cantrips", 1, 2],
      [3, 4, 5],
      [6, 7, 8, 9],
    ],
    rowHeight: 20,
    twoLineSlots: false,
    cantripLines: 5,
    spellbookLines: [17, 15, 13, 12, 11, 10, 9, 8, 6],
    turnUndead: false,
  },
  Cleric: {
    columns: [
      ["cantrips", 1, 2],
      [3, 4],
      [5, 6, 7],
    ],
    rowHeight: 11,
    twoLineSlots: true,
    cantripLines: 4,
    turnUndead: true,
  },
  Druid: {
    columns: [
      ["cantrips", 1, 2],
      [3, 4],
      [5, 6, 7],
    ],
    rowHeight: 16,
    twoLineSlots: true,
    cantripLines: 4,
    turnUndead: false,
  },
  Bard: {
    columns: [["cantrips", 1], [2], [3, 4], [5, 6]],
    rowHeight: 20,
    twoLineSlots: true,
    cantripLines: 4,
    turnUndead: false,
  },
  Paladin: {
    columns: [
      [1, 2],
      [3, 4, 5],
    ],
    rowHeight: 16,
    twoLineSlots: false,
    cantripLines: 0,
    turnUndead: true,
  },
  Ranger: {
    columns: [
      [1, 2],
      [3, 4, 5],
    ],
    rowHeight: 20,
    twoLineSlots: false,
    cantripLines: 0,
    turnUndead: false,
  },
};
