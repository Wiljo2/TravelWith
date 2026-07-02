import { describe, it, expect } from "vitest";
import {
  usdToCop, copToUsd,
  extraUnitUSD, extraGroupUSD, extraPerPersonUSD,
} from "./currency";
import type { Extra } from "@/types";

const RATE = 4000;

function extra(partial: Partial<Extra>): Extra {
  return { id: "x", label: "test", amount: 0, ...partial };
}

describe("conversions", () => {
  it("converts USD to COP rounding to integer", () => {
    expect(usdToCop(100, RATE)).toBe(400000);
    expect(usdToCop(0.5, RATE)).toBe(2000);
  });

  it("converts COP to USD and handles zero rate", () => {
    expect(copToUsd(400000, RATE)).toBe(100);
    expect(copToUsd(400000, 0)).toBe(0);
  });

  it("treats invalid amounts as zero", () => {
    expect(usdToCop(NaN, RATE)).toBe(0);
    expect(extraUnitUSD(NaN, "USD", RATE)).toBe(0);
  });
});

describe("extraUnitUSD", () => {
  it("passes USD through and converts COP", () => {
    expect(extraUnitUSD(100, "USD", RATE)).toBe(100);
    expect(extraUnitUSD(100, undefined, RATE)).toBe(100);
    expect(extraUnitUSD(400000, "COP", RATE)).toBe(100);
  });
});

describe("group expenses (splitMode: group / default)", () => {
  const cabin = extra({ amount: 858 });

  it("keeps the group total fixed regardless of people", () => {
    expect(extraGroupUSD(cabin, 2, RATE)).toBe(858);
    expect(extraGroupUSD(cabin, 3, RATE)).toBe(858);
  });

  it("per-person share goes DOWN when people are added", () => {
    expect(extraPerPersonUSD(cabin, 2, RATE)).toBe(429);
    expect(extraPerPersonUSD(cabin, 3, RATE)).toBe(286);
  });
});

describe("per-person expenses (splitMode: perPerson)", () => {
  const cruise = extra({ amount: 429, splitMode: "perPerson" });

  it("keeps the per-person cost fixed regardless of people", () => {
    expect(extraPerPersonUSD(cruise, 2, RATE)).toBe(429);
    expect(extraPerPersonUSD(cruise, 3, RATE)).toBe(429);
  });

  it("group total goes UP when people are added", () => {
    expect(extraGroupUSD(cruise, 2, RATE)).toBe(858);
    expect(extraGroupUSD(cruise, 3, RATE)).toBe(1287);
  });

  it("scales COP amounts through USD", () => {
    const copCruise = extra({ amount: 1716000, currency: "COP", splitMode: "perPerson" });
    expect(extraGroupUSD(copCruise, 2, RATE)).toBe(858);
  });
});

describe("people clamping", () => {
  it("never divides or multiplies by zero people", () => {
    const g = extra({ amount: 100 });
    const p = extra({ amount: 100, splitMode: "perPerson" });
    expect(extraPerPersonUSD(g, 0, RATE)).toBe(100);
    expect(extraGroupUSD(p, 0, RATE)).toBe(100);
  });
});
