import { describe, expect, it } from "vitest";
import { costText, gpToCopper, pay, totalCopper } from "../src/engine/coins";

const purse = (pp: number, gp: number, sp: number, cp: number) => ({ pp, gp, sp, cp });

describe("coins (5e rates, David)", () => {
  it("reads sheet costs in gp", () => {
    expect(gpToCopper(0.05)).toBe(5);
    expect(gpToCopper(15)).toBe(1500);
    expect(costText(0.05)).toBe("5 cp");
    expect(costText(0.1)).toBe("1 sp");
    expect(costText(0.5)).toBe("5 sp");
    expect(costText(75)).toBe("75 gp");
  });

  it("pays with the smallest coins first and gives change", () => {
    expect(pay(purse(0, 10, 0, 0), gpToCopper(0.05))).toEqual(purse(0, 9, 9, 5));
    expect(pay(purse(0, 2, 3, 7), gpToCopper(0.05))).toEqual(purse(0, 2, 3, 2));
    expect(pay(purse(1, 0, 0, 0), gpToCopper(15))).toBeNull();
    expect(pay(purse(2, 0, 0, 0), gpToCopper(15))).toEqual(purse(0, 5, 0, 0));
    expect(pay(purse(0, 1, 0, 0), gpToCopper(2))).toBeNull();
  });

  it("never changes the total except by the cost", () => {
    const start = purse(3, 7, 4, 9);
    for (const cost of [1, 9, 15, 99, 250, 1234, 3749]) {
      const left = pay(start, cost)!;
      expect(totalCopper(left)).toBe(totalCopper(start) - cost);
      expect(Object.values(left).every((n) => n >= 0)).toBe(true);
    }
  });
});
