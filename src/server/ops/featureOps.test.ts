import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock, type QueryHandler } from "@/test/supabaseMock";
import { documentPatch, ideaData, ideaSettingsPatch, mapsUrlArg, newDocumentRow, placesArg } from "@/server/domain/featureRows";
import { eventUpdatePatch } from "@/server/domain/eventRows";
import type { OpContext } from "@/server/ops/types";
import type { TripEventRow } from "@/types/database";

let handler: QueryHandler = () => undefined;
let mock = createSupabaseMock((q) => handler(q));

vi.mock("@/lib/supabase-server", () => ({ createServerClient: () => mock.client }));

const { runOp } = await import("@/server/ops");

const ctx: OpContext = { code: "ABCD1234", userId: "u1", role: "member" };
const DRIVE_ID = "1AbC_dEf-123456789xyz";
const event: TripEventRow = {
  room_code: "ABCD1234", id: "e1", day_id: "d0", position: 0, start_hour: 30, end_hour: 31, title: "Legado", cat: "actividad",
  note: null, maps_url: null, document_id: null, version: 2, updated_at: "t", updated_by: null,
};

beforeEach(() => {
  mock = createSupabaseMock((q) => handler(q));
});

describe("feature row validation", () => {
  it("documents: bare Drive id, title and kind", () => {
    expect(newDocumentRow({ id: "doc1", driveFileId: DRIVE_ID, title: " Vuelo " }, 3)).toEqual({
      id: "doc1", position: 3, drive_file_id: DRIVE_ID, title: "Vuelo", kind: "other",
    });
    expect(() => newDocumentRow({ driveFileId: `https://drive.google.com/file/d/${DRIVE_ID}/view`, title: "X" }, 0)).toThrow(/Drive file id/);
    expect(() => newDocumentRow({ driveFileId: DRIVE_ID, title: "X", kind: "passport" }, 0)).toThrow(/kind/);
    expect(() => documentPatch({ id: "doc1", driveFileId: "other" })).toThrow(/nothing to update/);
    expect(documentPatch({ id: "doc1", kind: "lodging" })).toEqual({ kind: "lodging" });
  });

  it("ideas are stored whole, without id and version", () => {
    expect(ideaData({ id: "i1", version: 4, url: "https://youtu.be/x", votes: ["u1"] })).toEqual({ url: "https://youtu.be/x", votes: ["u1"] });
    expect(() => ideaData({ title: "sin url" })).toThrow(/url/);
    expect(() => ideaData({ url: "https://x", transcript: "x".repeat(70000) })).toThrow(/too large/);
  });

  it("map places need a key and a kind; null clears", () => {
    const places = placesArg({ places: { e1: { key: "Museo|", kind: "place", lat: 1, version: 3 }, e2: null } });
    expect(places.get("e1")).toEqual({ key: "Museo|", kind: "place", lat: 1 });
    expect(places.get("e2")).toBeNull();
    expect(() => placesArg({ places: { e1: { kind: "boat" } } })).toThrow(/kind/);
    expect(() => placesArg({ places: {} })).toThrow(/nothing/);
  });

  it("idea settings accept only their own keys", () => {
    expect(ideaSettingsPatch({ ideaPlaces: ["Miami"], ideaPlan: null })).toEqual({ idea_places: ["Miami"], idea_plan: null });
    expect(() => ideaSettingsPatch({ ideaPlan: { payload: {} } })).toThrow(/only hold/);
    expect(() => ideaSettingsPatch({ ideaPlaces: [1] })).toThrow(/place names/);
  });

  it("activities take an https Maps link and a document; title edits skip the hour check", () => {
    expect(mapsUrlArg("")).toBeNull();
    expect(() => mapsUrlArg("javascript:alert(1)")).toThrow(/https/);
    expect(eventUpdatePatch(event, { id: "e1", mapsUrl: "https://maps.app.goo.gl/a", documentId: "doc1" })).toEqual({
      maps_url: "https://maps.app.goo.gl/a", document_id: "doc1",
    });
    expect(eventUpdatePatch(event, { id: "e1", title: "Nuevo" })).toEqual({ title: "Nuevo" });
    expect(() => eventUpdatePatch(event, { id: "e1", start: 10 })).toThrow(/time range|decimal hours/);
  });
});

describe("feature ops", () => {
  it("document.create appends and refuses a Drive file already linked", async () => {
    handler = (q) => {
      if (q.table === "trip_documents" && q.op === "select") return { data: [{ position: 1, drive_file_id: "1ZyX_wVu-987654321abc" }] };
      if (q.op === "insert") return { data: { ...(q.values as object), version: 1 } };
    };
    const result = await runOp("document.create", ctx, { args: { id: "doc2", driveFileId: DRIVE_ID, title: "Seguro", kind: "insurance" } });
    expect(result.changed[0]).toMatchObject({ table: "trip_documents", row: { id: "doc2", position: 2, updated_by: "u1" } });
    await expect(runOp("document.create", ctx, { args: { driveFileId: "1ZyX_wVu-987654321abc", title: "X" } })).rejects.toThrow(/already linked/);
  });

  it("idea.update replaces the idea, version-guarded", async () => {
    handler = (q) => (q.op === "update" ? { data: { id: "i1", version: 5, data: q.values } } : undefined);
    const result = await runOp("idea.update", ctx, { args: { id: "i1", idea: { url: "https://x", status: "planned" } }, expectedVersion: 4 });
    const update = mock.log.find((q) => q.op === "update")!;
    expect(update).toMatchObject({ table: "trip_ideas", values: { data: { url: "https://x", status: "planned" }, version: 5 } });
    expect(result.changed[0].table).toBe("trip_ideas");
  });

  it("eventPlace.set upserts places of existing activities and deletes cleared ones", async () => {
    handler = (q) => {
      if (q.table === "trip_events") return { data: [{ id: "e1" }, { id: "e2" }] };
      if (q.op === "upsert") return { data: (q.values as object[]).map((v) => ({ ...v, version: 1 })) };
      if (q.op === "rpc") return { data: { deleted: { id: "e2" } } };
    };
    const result = await runOp("eventPlace.set", ctx, { args: { places: { e1: { key: "k", kind: "place" }, e2: null } } });
    expect(result.changed.map((c) => c.row.id)).toEqual(["e1"]);
    expect(result.deleted).toEqual([{ table: "trip_event_places", id: "e2" }]);
    expect(mock.log.find((q) => q.op === "rpc")!.args).toMatchObject({ p_table: "trip_event_places", p_id: "e2" });
    await expect(runOp("eventPlace.set", ctx, { args: { places: { gone: { key: "k", kind: "none" } } } })).rejects.toThrow(/gone/);
  });

  it("trip.setIdeaSettings writes the rooms columns and returns the header", async () => {
    handler = (q) => (q.table === "rooms" ? { data: { code: "ABCD1234", idea_places: ["Miami"], idea_plan: null } } : undefined);
    const result = await runOp("trip.setIdeaSettings", ctx, { args: { ideaPlaces: ["Miami"] } });
    expect(mock.log[0]).toMatchObject({ table: "rooms", op: "update", values: { idea_places: ["Miami"] } });
    expect(result.trip?.idea_places).toEqual(["Miami"]);
  });

  it("event and expense ops reject a document that does not exist", async () => {
    handler = (q) => {
      if (q.table === "trip_events") return { data: event };
      if (q.table === "trip_documents") return { data: null };
    };
    await expect(runOp("event.update", ctx, { args: { id: "e1", documentId: "nope" }, expectedVersion: 2 })).rejects.toThrow(/Document "nope"/);
    await expect(runOp("expense.create", ctx, { args: { label: "A", amount: 1, documentId: "nope" } })).rejects.toThrow(/Document "nope"/);
  });
});
