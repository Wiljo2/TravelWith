import type { RoomPayload } from "@/types";
import { describe, it, expect } from "vitest";
import { DomainError } from "./core";
import { validateCat, validateHours } from "./events";
import { validatePriority, validateSchedule, validateTaskCat } from "./tasks";
import { tripOverview, dayDetail, budgetDetail } from "./read";

function basePayload(): RoomPayload {
  return {
    trip: { name: "Test Trip", startDate: "2026-11-26", endDate: "2026-11-28" },
    days: [
      {
        id: "d0", label: "Jue · Nov 26", sub: "", flexible: false,
        events: [{ id: "e1", start: 6, end: 10, title: "Vuelo", cat: "logist", note: "" }],
      },
      { id: "d1", label: "Vie · Nov 27", sub: "", flexible: false, events: [] },
    ],
    extras: [{ id: "x1", label: "Hotel", amount: 200, currency: "USD", splitMode: "group", linkedEventId: "e1" }],
    exchangeRate: 4000,
    tasks: [
      { id: "t1", title: "Empacar", done: false, dayId: "d0", start: 20, end: 21 },
      { id: "t2", title: "Comprar dólares", done: false },
    ],
    mockPeople: [],
    tripSpans: [],
  };
}

describe("validators", () => {
  it("checks event hours and categories", () => {
    expect(() => validateHours(10, 11)).not.toThrow();
    expect(() => validateHours(11, 10)).toThrow(DomainError);
    expect(() => validateHours(Number.NaN, 10)).toThrow(DomainError);
    expect(() => validateCat("logist")).not.toThrow();
    expect(() => validateCat("nope")).toThrow(DomainError);
  });

  it("checks task categories, priorities and schedules", () => {
    expect(() => validateTaskCat("nope")).toThrow(DomainError);
    expect(() => validatePriority("urgentisimo")).toThrow(DomainError);
    expect(() => validateSchedule(9, 9)).toThrow(DomainError);
    expect(() => validateSchedule(9, 10)).not.toThrow();
  });
});

describe("read serializers", () => {
  it("builds a compact overview and day detail", () => {
    const p = basePayload();
    const overview = tripOverview(p, 2);
    expect(overview.days[0]).toMatchObject({ dayId: "d0", eventCount: 1, taskCount: 1 });
    expect(overview.backlogTasks).toHaveLength(1);

    const detail = dayDetail(p, "d0");
    expect(detail.events[0].title).toBe("Vuelo");
    expect(detail.scheduledTasks[0].title).toBe("Empacar");
    expect(() => dayDetail(p, "zzz")).toThrow(DomainError);
  });

  it("summarizes the budget", () => {
    const budget = budgetDetail(basePayload(), 2);
    expect(JSON.stringify(budget)).toContain("Hotel");
  });
});
