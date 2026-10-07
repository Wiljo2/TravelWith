import { describe, expect, it } from "vitest";
import { checkDayRange, exchangeRateArg, expensePatch, newExpenseRow } from "@/server/domain/expenseRows";

describe("newExpenseRow", () => {
  it("applies USD / group defaults and keeps references", () => {
    expect(newExpenseRow({ id: "x1", label: " Hotel ", amount: 300, startDayId: "d0" }, 2)).toEqual({
      id: "x1", position: 2, label: "Hotel", amount: 300, currency: "USD", split_mode: "group",
      linked_event_id: null, start_day_id: "d0", end_day_id: null, document_id: null,
    });
  });

  it("rejects negative amounts, unknown currencies and split modes", () => {
    expect(() => newExpenseRow({ label: "A", amount: -1 }, 0)).toThrow(/non-negative/);
    expect(() => newExpenseRow({ label: "A", amount: 1, currency: "EUR" }, 0)).toThrow(/currency/);
    expect(() => newExpenseRow({ label: "A", amount: 1, splitMode: "each" }, 0)).toThrow(/splitMode/);
    expect(() => newExpenseRow({ label: " ", amount: 1 }, 0)).toThrow(/label is required/);
  });
});

describe("expensePatch", () => {
  it("clears references with null or the legacy flags", () => {
    expect(expensePatch({ id: "x1", linkedEventId: null })).toEqual({ linked_event_id: null });
    expect(expensePatch({ id: "x1", unlinkEvent: true, clearDayRange: true })).toEqual({
      linked_event_id: null, start_day_id: null, end_day_id: null,
    });
  });

  it("maps camelCase fields to columns", () => {
    expect(expensePatch({ id: "x1", amount: 50000, currency: "COP", splitMode: "perPerson" })).toEqual({
      amount: 50000, currency: "COP", split_mode: "perPerson",
    });
    expect(() => expensePatch({ id: "x1" })).toThrow(/nothing to update/);
  });
});

describe("checkDayRange and exchangeRateArg", () => {
  const positions = new Map([["d0", 0], ["d1", 1]]);
  it("needs a start day and a forward range", () => {
    expect(() => checkDayRange(positions, null, "d1")).toThrow(/requires startDayId/);
    expect(() => checkDayRange(positions, "d1", "d0")).toThrow(/later day/);
    expect(() => checkDayRange(positions, "d0", "d1")).not.toThrow();
  });

  it("accepts only positive rates", () => {
    expect(exchangeRateArg({ rate: 4100 })).toBe(4100);
    expect(() => exchangeRateArg({ rate: 0 })).toThrow(/positive/);
  });
});
