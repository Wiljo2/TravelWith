import { beforeEach, describe, expect, it, vi } from "vitest";
import { auth, params, request, resetDb, supabaseServerMock } from "@/test/routeHelpers";
import { filterValue, type RecordedQuery, type QueryResult } from "@/test/supabaseMock";

vi.mock("@/lib/supabase-server", () => supabaseServerMock);

const { POST } = await import("./route");

const CODE = "ABCD1234";
const eventRow = (over: Record<string, unknown> = {}) => ({
  room_code: CODE, id: "e1", day_id: "d0", position: 0, start_hour: 9, end_hour: 10,
  title: "Museo", cat: "tour", note: "", version: 1, updated_at: "t", updated_by: null, ...over,
});

function member(q: RecordedQuery): QueryResult | undefined {
  if (q.table !== "user_rooms") return undefined;
  return { data: filterValue(q, "user_id") === "u-member" ? { role: "member" } : null };
}

const post = (body: unknown, token = "tok-member") => POST(request("POST", token, body), params(CODE));

beforeEach(() => {
  auth.users = { "tok-member": { id: "u-member" }, "tok-stranger": { id: "u-stranger" } };
});

describe("POST /api/rooms/[code]/ops access", () => {
  it("requires a token and membership", async () => {
    resetDb((q) => member(q));
    expect((await POST(request("POST", undefined, { op: "event.delete", args: { id: "e1" } }), params(CODE))).status).toBe(401);
    expect((await post({ op: "event.delete", args: { id: "e1" } }, "tok-stranger")).status).toBe(403);
  });

  it("rejects malformed bodies and unknown ops", async () => {
    resetDb((q) => member(q));
    expect((await post({ op: "event.create" })).status).toBe(400);
    expect((await post({ op: "event.update", args: { id: "e1" }, expectedVersion: 0 })).status).toBe(400);
    const res = await post({ op: "rooms.dropAll", args: {} });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Operación desconocida");
  });
});

describe("event ops", () => {
  it("event.create checks the day, appends at the end of the day and records the user", async () => {
    const db = resetDb((q) => {
      if (member(q)) return member(q);
      if (q.table === "trip_days") return { data: { id: "d0" } };
      if (q.table === "trip_events" && q.op === "select") return { data: [eventRow({ position: 3 })] };
      if (q.table === "trip_events" && q.op === "insert") return { data: { ...(q.values as object), version: 1 } };
    });
    const res = await post({ op: "event.create", args: { id: "enew1", dayId: "d0", title: "Cena", start: 19, end: 21 } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.changed[0]).toMatchObject({ table: "trip_events", row: { id: "enew1", position: 4, room_code: CODE } });
    expect(db.log.find((q) => q.op === "insert")?.values).toMatchObject({ updated_by: "u-member" });
  });

  it("event.create with a missing day is a 400 with the domain message", async () => {
    resetDb((q) => member(q) ?? { data: null });
    const res = await post({ op: "event.create", args: { dayId: "d9", title: "A", start: 9, end: 10 } });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("d9");
  });

  it("event.update sends the expected version and returns the new row", async () => {
    const db = resetDb((q) => {
      if (member(q)) return member(q);
      if (q.op === "select") return { data: eventRow({ version: 2 }) };
      if (q.op === "update") return { data: eventRow({ title: "Nuevo", version: 3 }) };
    });
    const res = await post({ op: "event.update", args: { id: "e1", title: "Nuevo" }, expectedVersion: 2 });
    expect(res.status).toBe(200);
    expect((await res.json()).changed[0].row.version).toBe(3);
    expect(filterValue(db.log.find((q) => q.op === "update")!, "version")).toBe(2);
  });

  it("a stale version answers 409 with the current row", async () => {
    resetDb((q) => {
      if (member(q)) return member(q);
      if (q.op === "update") return { data: null };
      return { data: eventRow({ title: "De otro", version: 5 }) };
    });
    const res = await post({ op: "event.update", args: { id: "e1", title: "Mío" }, expectedVersion: 2 });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body).toMatchObject({ table: "trip_events", current: { title: "De otro", version: 5 } });
  });

  it("event.update on a deleted event is a 404", async () => {
    resetDb((q) => member(q) ?? { data: null });
    expect((await post({ op: "event.update", args: { id: "e1", title: "x" } })).status).toBe(404);
  });

  it("event.move to another day takes the next position there", async () => {
    const db = resetDb((q) => {
      if (member(q)) return member(q);
      if (q.table === "trip_days") return { data: { id: "d1" } };
      if (q.table === "trip_events" && q.op === "select") {
        return filterValue(q, "day_id") === "d1" ? { data: [] } : { data: eventRow() };
      }
      if (q.op === "update") return { data: eventRow({ day_id: "d1", version: 2 }) };
    });
    const res = await post({ op: "event.move", args: { id: "e1", dayId: "d1" }, expectedVersion: 1 });
    expect(res.status).toBe(200);
    expect(db.log.find((q) => q.op === "update")?.values).toMatchObject({ day_id: "d1", position: 0, start_hour: 9 });
  });

  it("event.delete goes through delete_trip_row", async () => {
    const db = resetDb((q) => member(q) ?? (q.op === "rpc" ? { data: { deleted: eventRow() } } : undefined));
    const res = await post({ op: "event.delete", args: { id: "e1" }, expectedVersion: 1 });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ changed: [], deleted: [{ table: "trip_events", id: "e1" }] });
    expect(db.log.find((q) => q.op === "rpc")?.args).toMatchObject({ p_table: "trip_events", p_user: "u-member" });
  });

  it("hides database errors", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    resetDb((q) => member(q) ?? { error: { code: "XX000", message: "relation trip_events does not exist" } });
    const res = await post({ op: "event.delete", args: { id: "e1" } });
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("relation");
  });
});
