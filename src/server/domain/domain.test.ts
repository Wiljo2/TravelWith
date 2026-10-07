import type { RoomPayload } from "@/types";
import { describe, it, expect } from "vitest";
import { DomainError } from "./core";
import { addEvent, updateEvent, deleteEvent } from "./events";
import { addTask, updateTask, deleteTask } from "./tasks";
import { addExtra, updateExtra, removeExtra, setExchangeRate } from "./extras";
import { addDocument, updateDocument, removeDocument, linkDocument } from "./documents";
import { tripOverview, dayDetail, budgetDetail } from "./read";

function basePayload(): RoomPayload {
  return {
    trip: { name: "Test Trip", startDate: "2026-11-26", endDate: "2026-11-28" },
    days: [
      { id: "d0", label: "Jue · Nov 26", sub: "", flexible: false, events: [] },
      { id: "d1", label: "Vie · Nov 27", sub: "", flexible: false, events: [] },
    ],
    extras: [],
    exchangeRate: 4000,
    tasks: [],
    mockPeople: [],
    tripSpans: [],
  };
}

describe("events", () => {
  it("adds an event to the right day", () => {
    const { payload, event } = addEvent(basePayload(), { dayId: "d1", title: "Cena", start: 19, end: 21 });
    expect(payload.days[1].events).toHaveLength(1);
    expect(payload.days[0].events).toHaveLength(0);
    expect(event.cat).toBe("actividad");
  });

  it("rejects unknown days, empty titles, bad hours, bad categories", () => {
    expect(() => addEvent(basePayload(), { dayId: "nope", title: "X", start: 10, end: 11 })).toThrow(DomainError);
    expect(() => addEvent(basePayload(), { dayId: "d0", title: "  ", start: 10, end: 11 })).toThrow(DomainError);
    expect(() => addEvent(basePayload(), { dayId: "d0", title: "X", start: 11, end: 10 })).toThrow(DomainError);
    expect(() => addEvent(basePayload(), { dayId: "d0", title: "X", start: 25, end: 27 })).toThrow(DomainError);
    expect(() => addEvent(basePayload(), { dayId: "d0", title: "X", start: 10, end: 11, cat: "zzz" })).toThrow(DomainError);
  });

  it("updates and moves an event across days", () => {
    const created = addEvent(basePayload(), { dayId: "d0", title: "Museo", start: 10, end: 12 });
    const { payload, event } = updateEvent(created.payload, created.event.id, { dayId: "d1", start: 14, end: 16 });
    expect(payload.days[0].events).toHaveLength(0);
    expect(payload.days[1].events[0].id).toBe(event.id);
    expect(event.start).toBe(14);
    expect(event.title).toBe("Museo");
  });

  it("deleting an event unlinks its expenses", () => {
    const created = addEvent(basePayload(), { dayId: "d0", title: "Tour", start: 9, end: 12 });
    const withExpense = addExtra(created.payload, { label: "Tour fee", amount: 50, linkedEventId: created.event.id });
    const { payload } = deleteEvent(withExpense.payload, created.event.id);
    expect(payload.days[0].events).toHaveLength(0);
    expect(payload.extras[0].linkedEventId).toBeUndefined();
  });
});

describe("tasks", () => {
  it("adds a backlog task and a scheduled task", () => {
    const backlog = addTask(basePayload(), { title: "Comprar chip" });
    expect(backlog.task.dayId).toBeUndefined();

    const scheduled = addTask(basePayload(), { title: "Decidir excursión", dayId: "d0", start: 15, priority: "alta" });
    expect(scheduled.task.dayId).toBe("d0");
    expect(scheduled.task.end).toBe(16);
  });

  it("schedules, unschedules and completes a task", () => {
    const created = addTask(basePayload(), { title: "Reservar cena" });
    const scheduled = updateTask(created.payload, created.task.id, { dayId: "d1", start: 18, end: 19 });
    expect(scheduled.task.dayId).toBe("d1");

    const unscheduled = updateTask(scheduled.payload, created.task.id, { unschedule: true, done: true });
    expect(unscheduled.task.dayId).toBeUndefined();
    expect(unscheduled.task.done).toBe(true);
  });

  it("rejects invalid category/priority and unknown ids", () => {
    expect(() => addTask(basePayload(), { title: "X", cat: "zzz" })).toThrow(DomainError);
    expect(() => addTask(basePayload(), { title: "X", priority: "urgent" })).toThrow(DomainError);
    expect(() => updateTask(basePayload(), "missing", { done: true })).toThrow(DomainError);
    expect(() => deleteTask(basePayload(), "missing")).toThrow(DomainError);
  });
});

describe("extras", () => {
  it("adds group and perPerson expenses with correct math", () => {
    const a = addExtra(basePayload(), { label: "Cabaña", amount: 300 });
    const b = addExtra(a.payload, { label: "Crucero", amount: 429, splitMode: "perPerson" });
    const budget = budgetDetail(b.payload, 3);

    const cabin = budget.expenses.find((e) => e.label === "Cabaña")!;
    expect(cabin.groupTotalUSD).toBe(300);
    expect(cabin.perPersonUSD).toBe(100);

    const cruise = budget.expenses.find((e) => e.label === "Crucero")!;
    expect(cruise.groupTotalUSD).toBe(1287);
    expect(cruise.perPersonUSD).toBe(429);
  });

  it("validates currency, splitMode, day range and linked event", () => {
    expect(() => addExtra(basePayload(), { label: "X", amount: 1, currency: "EUR" })).toThrow(DomainError);
    expect(() => addExtra(basePayload(), { label: "X", amount: 1, splitMode: "half" })).toThrow(DomainError);
    expect(() => addExtra(basePayload(), { label: "X", amount: 1, endDayId: "d1" })).toThrow(DomainError);
    expect(() => addExtra(basePayload(), { label: "X", amount: 1, linkedEventId: "nope" })).toThrow(DomainError);
    expect(() => addExtra(basePayload(), { label: "X", amount: -5 })).toThrow(DomainError);
  });

  it("updates, unlinks and removes expenses", () => {
    const created = addExtra(basePayload(), { label: "Hotel", amount: 400, startDayId: "d0", endDayId: "d1" });
    const updated = updateExtra(created.payload, created.extra.id, { amount: 500, splitMode: "perPerson", clearDayRange: true });
    expect(updated.extra.amount).toBe(500);
    expect(updated.extra.startDayId).toBeUndefined();

    const removed = removeExtra(updated.payload, created.extra.id);
    expect(removed.payload.extras).toHaveLength(0);
  });

  it("sets the exchange rate with validation", () => {
    expect(setExchangeRate(basePayload(), 4200).payload.exchangeRate).toBe(4200);
    expect(() => setExchangeRate(basePayload(), 0)).toThrow(DomainError);
  });
});

describe("read serializers", () => {
  it("builds a compact overview and day detail", () => {
    let p = basePayload();
    p = addEvent(p, { dayId: "d0", title: "Vuelo", start: 6, end: 10, cat: "logist" }).payload;
    p = addTask(p, { title: "Empacar", dayId: "d0", start: 20 }).payload;
    p = addTask(p, { title: "Comprar dólares" }).payload;

    const overview = tripOverview(p, 2);
    expect(overview.days[0]).toMatchObject({ dayId: "d0", eventCount: 1, taskCount: 1 });
    expect(overview.backlogTasks).toHaveLength(1);

    const detail = dayDetail(p, "d0");
    expect(detail.events[0].title).toBe("Vuelo");
    expect(detail.scheduledTasks[0].title).toBe("Empacar");
    expect(() => dayDetail(p, "zzz")).toThrow(DomainError);
  });
});

describe("input checks (untyped tool input)", () => {
  const bad = <T>(v: unknown) => v as T;

  it("turns wrong types into DomainError instead of TypeError", () => {
    expect(() => addEvent(basePayload(), bad({ dayId: "d0", title: 42, start: 10, end: 11 }))).toThrow(DomainError);
    expect(() => addTask(basePayload(), bad({ title: null }))).toThrow(DomainError);
    expect(() => addExtra(basePayload(), bad({ label: "X", amount: "10" }))).toThrow(DomainError);
    const { payload, task } = addTask(basePayload(), { title: "T" });
    expect(() => updateTask(payload, task.id, bad({ start: "9", dayId: "d0" }))).toThrow(DomainError);
    expect(() => updateTask(payload, task.id, bad({ done: "yes" }))).toThrow(DomainError);
  });

  it("caps string lengths", () => {
    expect(() => addEvent(basePayload(), { dayId: "d0", title: "X", start: 10, end: 11, note: "n".repeat(5000) })).toThrow(DomainError);
    expect(() => addTask(basePayload(), { title: "t".repeat(300) })).toThrow(DomainError);
  });

  it("rejects expense day ranges that end before they start", () => {
    expect(() => addExtra(basePayload(), { label: "Hotel", amount: 100, startDayId: "d1", endDayId: "d0" })).toThrow(DomainError);
    const { payload, extra } = addExtra(basePayload(), { label: "Hotel", amount: 100, startDayId: "d0", endDayId: "d1" });
    expect(() => updateExtra(payload, extra.id, { startDayId: "d1", endDayId: "d0" })).toThrow(DomainError);
    expect(() => updateExtra(payload, extra.id, { endDayId: "d0" })).not.toThrow();
  });
});

describe("documents", () => {
  const DRIVE_ID = "1AbC_dEf-123456789xyz";

  it("adds a document reference with a default kind", () => {
    const { payload, document } = addDocument(basePayload(), { driveFileId: DRIVE_ID, title: " Vuelo ida " });
    expect(payload.documents).toHaveLength(1);
    expect(document).toMatchObject({ driveFileId: DRIVE_ID, title: "Vuelo ida", kind: "other" });
  });

  it("rejects links, bad kinds, empty titles and duplicates", () => {
    expect(() => addDocument(basePayload(), { driveFileId: `https://drive.google.com/file/d/${DRIVE_ID}/view`, title: "X" })).toThrow(DomainError);
    expect(() => addDocument(basePayload(), { driveFileId: DRIVE_ID, title: "X", kind: "passport" })).toThrow(DomainError);
    expect(() => addDocument(basePayload(), { driveFileId: DRIVE_ID, title: "  " })).toThrow(DomainError);
    expect(() => addDocument(basePayload(), { driveFileId: DRIVE_ID, title: "t".repeat(121) })).toThrow(DomainError);
    const { payload } = addDocument(basePayload(), { driveFileId: DRIVE_ID, title: "X" });
    expect(() => addDocument(payload, { driveFileId: DRIVE_ID, title: "Y" })).toThrow(DomainError);
  });

  it("renames and re-kinds a document", () => {
    const created = addDocument(basePayload(), { driveFileId: DRIVE_ID, title: "Hotel" });
    const { document } = updateDocument(created.payload, created.document.id, { title: "Hotel Madrid", kind: "lodging" });
    expect(document).toMatchObject({ title: "Hotel Madrid", kind: "lodging" });
    expect(() => updateDocument(created.payload, "missing", { title: "X" })).toThrow(DomainError);
  });

  it("links events and expenses, and removing the document unlinks them", () => {
    let p = addDocument(basePayload(), { driveFileId: DRIVE_ID, title: "Vuelo" }).payload;
    const docId = p.documents![0].id;
    const ev = addEvent(p, { dayId: "d0", title: "Vuelo", start: 6, end: 10 });
    const ex = addExtra(ev.payload, { label: "Tiquete", amount: 300, splitMode: "perPerson" });
    p = linkDocument(ex.payload, { eventId: ev.event.id }, docId).payload;
    p = linkDocument(p, { extraId: ex.extra.id }, docId).payload;
    expect(p.days[0].events[0].documentId).toBe(docId);
    expect(dayDetail(p, "d0").events[0].documentId).toBe(docId);
    expect(budgetDetail(p, 2).expenses[0].documentId).toBe(docId);

    expect(() => linkDocument(p, { eventId: "nope" }, docId)).toThrow(DomainError);
    expect(() => linkDocument(p, { extraId: ex.extra.id }, "nope")).toThrow(DomainError);

    const removed = removeDocument(p, docId).payload;
    expect(removed.documents).toHaveLength(0);
    expect(removed.days[0].events[0].documentId).toBeUndefined();
    expect(removed.extras[0].documentId).toBeUndefined();
  });

  it("exposes only titles and kinds in the overview", () => {
    const { payload } = addDocument(basePayload(), { driveFileId: DRIVE_ID, title: "Seguro", kind: "insurance" });
    const docs = tripOverview(payload, 1).documents;
    expect(docs).toEqual([{ documentId: payload.documents![0].id, title: "Seguro", kind: "insurance" }]);
    expect(JSON.stringify(docs)).not.toContain(DRIVE_ID);
  });
});
