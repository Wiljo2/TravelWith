import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock, filterValue, type QueryHandler } from "@/test/supabaseMock";
import { HttpError } from "@/server/http";
import type { TripEventRow } from "@/types/database";

let handler: QueryHandler = () => undefined;
let mock = createSupabaseMock((q) => handler(q));

vi.mock("@/lib/supabase-server", () => ({
  createServerClient: () => mock.client,
}));

const { eventsRepo } = await import("./events");
const { expensesRepo } = await import("./expenses");
const { RowConflictError, RowNotFoundError } = await import("./errors");

const USER = "00000000-0000-0000-0000-000000000001";
const CODE = "ABCD1234";

const event = (over: Partial<TripEventRow> = {}): TripEventRow => ({
  room_code: CODE,
  id: "e1",
  day_id: "d0",
  position: 0,
  start_hour: 9,
  end_hour: 10,
  title: "Museo",
  cat: "tour",
  note: null,
  maps_url: null,
  document_id: null,
  icon: null,
  version: 1,
  updated_at: "2026-09-29T00:00:00Z",
  updated_by: null,
  ...over,
});

beforeEach(() => {
  mock = createSupabaseMock((q) => handler(q));
});

describe("tableRepo reads", () => {
  it("lists a trip's rows, optionally scoped to one column", async () => {
    handler = () => ({ data: [event()] });
    const rows = await eventsRepo.list(CODE, { column: "day_id", value: "d0" });
    expect(rows).toHaveLength(1);
    const q = mock.log[0];
    expect(q.table).toBe("trip_events");
    expect(filterValue(q, "room_code")).toBe(CODE);
    expect(filterValue(q, "day_id")).toBe("d0");
  });

  it("returns null for a missing row", async () => {
    handler = () => ({ data: null });
    expect(await eventsRepo.get(CODE, "nope")).toBeNull();
  });

  it("computes the next position after the last row", async () => {
    handler = () => ({ data: { position: 4 } });
    expect(await eventsRepo.nextPosition(CODE, { column: "day_id", value: "d0" })).toBe(5);
    handler = () => ({ data: null });
    expect(await eventsRepo.nextPosition(CODE)).toBe(0);
  });
});

describe("tableRepo.insert", () => {
  it("sets room_code and updated_by, never the client's version", async () => {
    handler = (q) => ({ data: { ...(q.values as object), version: 1 } });
    const row = await eventsRepo.insert(
      CODE,
      { id: "e2", day_id: "d0", start_hour: 9, end_hour: 10, title: "A", cat: "tour" },
      USER,
    );
    expect(row.room_code).toBe(CODE);
    expect(mock.log[0].values).toMatchObject({ room_code: CODE, updated_by: USER });
    expect(mock.log[0].values).not.toHaveProperty("version");
  });

  it("maps a duplicate id to a 409", async () => {
    handler = () => ({ error: { code: "23505", message: "duplicate key" } });
    const err = await eventsRepo
      .insert(CODE, { id: "e1", day_id: "d0", start_hour: 9, end_hour: 10, title: "A", cat: "tour" }, USER)
      .catch((e) => e);
    expect(err).toBeInstanceOf(HttpError);
    expect(err.status).toBe(409);
    expect(err.message).not.toContain("duplicate key");
  });

  it("keeps unknown database errors generic", async () => {
    handler = () => ({ error: { code: "XX000", message: "internal detail" } });
    const err = await eventsRepo
      .insert(CODE, { id: "e1", day_id: "d0", start_hour: 9, end_hour: 10, title: "A", cat: "tour" }, USER)
      .catch((e) => e);
    expect(err).not.toBeInstanceOf(HttpError);
  });
});

describe("tableRepo.update", () => {
  it("guards on the expected version and bumps it", async () => {
    handler = (q) => (q.op === "update" ? { data: event({ title: "Nuevo", version: 3 }) } : undefined);
    const row = await eventsRepo.update(CODE, "e1", { title: "Nuevo" }, 2, USER);
    expect(row.version).toBe(3);
    const q = mock.log[0];
    expect(filterValue(q, "version")).toBe(2);
    expect(filterValue(q, "id")).toBe("e1");
    expect(q.values).toMatchObject({ title: "Nuevo", version: 3, updated_by: USER });
  });

  it("throws a conflict with the current row when the version is stale", async () => {
    const current = event({ title: "De otro", version: 5 });
    handler = (q) => (q.op === "update" ? { data: null } : { data: current });
    const err = await eventsRepo.update(CODE, "e1", { title: "Mío" }, 2, USER).catch((e) => e);
    expect(err).toBeInstanceOf(RowConflictError);
    expect(err.status).toBe(409);
    expect(err.current).toEqual(current);
  });

  it("throws not found when the row is gone", async () => {
    handler = () => ({ data: null });
    const err = await eventsRepo.update(CODE, "e1", { title: "x" }, 2, USER).catch((e) => e);
    expect(err).toBeInstanceOf(RowNotFoundError);
    expect(err.status).toBe(404);
  });

  it("without an expected version, reads the current one and retries once on a race", async () => {
    let reads = 0;
    let writes = 0;
    handler = (q) => {
      if (q.op === "select") return { data: event({ version: ++reads + 1 }) };
      writes++;
      return { data: writes === 2 ? event({ version: 4 }) : null };
    };
    const row = await eventsRepo.update(CODE, "e1", { title: "x" }, undefined, USER);
    expect(row.version).toBe(4);
    const updates = mock.log.filter((q) => q.op === "update");
    expect(updates.map((q) => filterValue(q, "version"))).toEqual([2, 4]);
  });
});

describe("tableRepo.remove", () => {
  it("deletes through delete_trip_row with the acting user", async () => {
    handler = () => ({ data: { deleted: event() } });
    const row = await expensesRepo.remove(CODE, "x1", 3, USER);
    expect(row).not.toBeNull();
    expect(mock.log[0]).toMatchObject({
      op: "rpc",
      table: "delete_trip_row",
      args: { p_table: "trip_expenses", p_code: CODE, p_id: "x1", p_expected_version: 3, p_user: USER },
    });
  });

  it("throws a conflict when the row changed", async () => {
    handler = () => ({ data: { deleted: null, current: event({ version: 7 }) } });
    const err = await eventsRepo.remove(CODE, "e1", 3, USER).catch((e) => e);
    expect(err).toBeInstanceOf(RowConflictError);
    expect(err.current.version).toBe(7);
  });

  it("is idempotent when the row is already gone", async () => {
    handler = () => ({ data: { deleted: null, current: null } });
    expect(await eventsRepo.remove(CODE, "e1", undefined, USER)).toBeNull();
    expect(mock.log[0].args).toMatchObject({ p_expected_version: null });
  });
});
