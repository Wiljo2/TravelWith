import type { RoomPayload } from "@/types";
import { describe, it, expect } from "vitest";
import { DomainError } from "./core";
import { validateCat, validateHours } from "./events";
import { validatePriority, validateSchedule, validateTaskCat } from "./tasks";
import { addDocument, updateDocument, removeDocument, linkDocument } from "./documents";
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
    p = linkDocument(p, { eventId: "e1" }, docId).payload;
    p = linkDocument(p, { extraId: "x1" }, docId).payload;
    expect(p.days[0].events[0].documentId).toBe(docId);
    expect(dayDetail(p, "d0").events[0].documentId).toBe(docId);
    expect(budgetDetail(p, 2).expenses[0].documentId).toBe(docId);

    expect(() => linkDocument(p, { eventId: "nope" }, docId)).toThrow(DomainError);
    expect(() => linkDocument(p, { extraId: "x1" }, "nope")).toThrow(DomainError);

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
