import { describe, expect, it } from "vitest";
import { DomainError } from "@/server/domain/core";
import { eventMovePatch, eventUpdatePatch, newEventRow } from "@/server/domain/eventRows";
import { DEFAULT_EVENT_CAT } from "@/constants/categories";
import type { TripEventRow } from "@/types/database";

const current: TripEventRow = {
  room_code: "ABCD1234",
  id: "e1",
  day_id: "d0",
  position: 2,
  start_hour: 9,
  end_hour: 10,
  title: "Museo",
  cat: DEFAULT_EVENT_CAT,
  note: null,
  maps_url: null,
  document_id: null,
  version: 3,
  updated_at: "2026-09-29T00:00:00Z",
  updated_by: null,
};

describe("newEventRow", () => {
  it("builds a row with defaults and a generated id", () => {
    const row = newEventRow({ dayId: "d0", title: "  Cena ", start: 19, end: 21 }, 4);
    expect(row).toMatchObject({ day_id: "d0", title: "Cena", start_hour: 19, end_hour: 21, cat: DEFAULT_EVENT_CAT, note: "", position: 4 });
    expect(row.id).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("keeps a valid client id and rejects unsafe ones", () => {
    expect(newEventRow({ id: "eabc_1", dayId: "d0", title: "A", start: 9, end: 10 }, 0).id).toBe("eabc_1");
    expect(() => newEventRow({ id: "../x", dayId: "d0", title: "A", start: 9, end: 10 }, 0)).toThrow(DomainError);
  });

  it("rejects bad hours, categories, types and empty titles", () => {
    expect(() => newEventRow({ dayId: "d0", title: "A", start: 10, end: 9 }, 0)).toThrow(/time range/);
    expect(() => newEventRow({ dayId: "d0", title: "A", start: 9, end: 10, cat: "nope" }, 0)).toThrow(/category/);
    expect(() => newEventRow({ dayId: "d0", title: "A", start: "9", end: 10 }, 0)).toThrow(/start must be a number/);
    expect(() => newEventRow({ dayId: "d0", title: "   ", start: 9, end: 10 }, 0)).toThrow(/title is required/);
    expect(() => newEventRow({ title: "A", start: 9, end: 10 }, 0)).toThrow(/dayId is required/);
  });
});

describe("eventUpdatePatch", () => {
  it("returns only the changed columns", () => {
    expect(eventUpdatePatch(current, { id: "e1", title: " Nuevo ", note: "x" })).toEqual({ title: "Nuevo", note: "x" });
  });

  it("validates hours against the stored values", () => {
    expect(eventUpdatePatch(current, { id: "e1", end: 12 })).toEqual({ end_hour: 12 });
    expect(() => eventUpdatePatch(current, { id: "e1", end: 8 })).toThrow(/time range/);
  });

  it("rejects empty patches and empty titles", () => {
    expect(() => eventUpdatePatch(current, { id: "e1" })).toThrow(/nothing to update/);
    expect(() => eventUpdatePatch(current, { id: "e1", title: " " })).toThrow(/title cannot be empty/);
  });
});

describe("eventMovePatch", () => {
  it("moves to another day keeping the hours, with the op's position", () => {
    expect(eventMovePatch(current, { id: "e1", dayId: "d1" }, 7)).toEqual({ day_id: "d1", start_hour: 9, end_hour: 10, position: 7 });
  });

  it("changes hours within the same day", () => {
    expect(eventMovePatch(current, { id: "e1", dayId: "d0", start: 14, end: 15.5 })).toEqual({ day_id: "d0", start_hour: 14, end_hour: 15.5 });
    expect(() => eventMovePatch(current, { id: "e1", dayId: "d0", start: 25, end: 27 })).toThrow(/time range/);
  });
});
