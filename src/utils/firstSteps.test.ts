import { describe, expect, it } from "vitest";
import { firstSteps, initialVisibility, parseVisibility, type FirstStepsData } from "@/utils/firstSteps";
import type { CalendarEvent } from "@/types";

const EVENT: CalendarEvent = { id: "e1", start: 9, end: 10, title: "Museo del Oro", cat: "cultura", note: "" };

const EMPTY: FirstStepsData = {
  members: 1,
  days: [{ events: [] }, { events: [] }],
  ideas: 0,
  expenses: 0,
  documents: 0,
};

const doneKeys = (data: FirstStepsData) => firstSteps(data).steps.filter((s) => s.done).map((s) => s.key);

describe("firstSteps", () => {
  it("lists the five steps in order, with labels and tabs", () => {
    expect(firstSteps(EMPTY).steps).toEqual([
      { key: "invite", label: "Invita a tu grupo", done: false },
      { key: "activity", label: "Agrega tu primera actividad", done: false, tab: "calendar" },
      { key: "idea", label: "Guarda una idea (TikTok, reel o link)", done: false, tab: "ideas" },
      { key: "expense", label: "Registra un gasto", done: false, tab: "budget" },
      { key: "document", label: "Enlaza un documento (reservas, tiquetes)", done: false },
    ]);
    expect(firstSteps(EMPTY).doneCount).toBe(0);
  });

  it("counts the group as invited only once someone else joined", () => {
    expect(doneKeys({ ...EMPTY, members: 0 })).toEqual([]);
    expect(doneKeys({ ...EMPTY, members: 1 })).toEqual([]);
    expect(doneKeys({ ...EMPTY, members: 2 })).toEqual(["invite"]);
  });

  it("finds an activity in any day", () => {
    expect(doneKeys({ ...EMPTY, days: [] })).toEqual([]);
    expect(doneKeys({ ...EMPTY, days: [{ events: [] }, { events: [EVENT] }] })).toEqual(["activity"]);
  });

  it("marks ideas, expenses and documents once there is one", () => {
    expect(doneKeys({ ...EMPTY, ideas: 1 })).toEqual(["idea"]);
    expect(doneKeys({ ...EMPTY, expenses: 3 })).toEqual(["expense"]);
    expect(doneKeys({ ...EMPTY, documents: 1 })).toEqual(["document"]);
  });

  it("counts the steps done", () => {
    const all: FirstStepsData = { members: 3, days: [{ events: [EVENT] }], ideas: 2, expenses: 1, documents: 4 };
    expect(firstSteps(all).doneCount).toBe(5);
    expect(firstSteps({ ...all, ideas: 0, documents: 0 }).doneCount).toBe(3);
  });
});

describe("initialVisibility", () => {
  it("shows the card on a trip that is just starting", () => {
    expect(initialVisibility(0)).toBe("shown");
    expect(initialVisibility(1)).toBe("shown");
  });

  it("never shows it on a trip already under way", () => {
    expect(initialVisibility(2)).toBe("dismissed");
    expect(initialVisibility(5)).toBe("dismissed");
  });
});

describe("parseVisibility", () => {
  it("accepts only the stored values", () => {
    expect(parseVisibility("shown")).toBe("shown");
    expect(parseVisibility("dismissed")).toBe("dismissed");
    expect(parseVisibility(null)).toBeNull();
    expect(parseVisibility("")).toBeNull();
    expect(parseVisibility("true")).toBeNull();
  });
});
