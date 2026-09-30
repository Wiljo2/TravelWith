import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock, filterValue, type QueryHandler } from "@/test/supabaseMock";
import type { OpContext } from "@/server/ops/types";

let handler: QueryHandler = () => undefined;
let mock = createSupabaseMock((q) => handler(q));

vi.mock("@/lib/supabase-server", () => ({ createServerClient: () => mock.client }));

const { runOp } = await import("@/server/ops");
const { DomainError } = await import("@/server/domain/core");

const member: OpContext = { code: "ABCD1234", userId: "u1", role: "member" };
const owner: OpContext = { ...member, role: "owner" };

beforeEach(() => {
  mock = createSupabaseMock((q) => handler(q));
});

describe("day ops", () => {
  it("day.swap calls swap_days and returns the moved rows", async () => {
    handler = (q) => (q.op === "rpc" ? { data: { events: [{ id: "e1", version: 2 }], daySpans: [{ id: "s1", version: 2 }] } } : undefined);
    const result = await runOp("day.swap", member, { args: { a: "d0", b: "d1" } });
    expect(mock.log[0]).toMatchObject({ table: "swap_days", args: { p_code: "ABCD1234", p_a: "d0", p_b: "d1", p_user: "u1" } });
    expect(result.changed.map((c) => c.table)).toEqual(["trip_events", "trip_day_spans"]);
  });

  it("day.update is version-guarded", async () => {
    handler = (q) => (q.op === "update" ? { data: { id: "d0", version: 4 } } : undefined);
    await runOp("day.update", member, { args: { id: "d0", sub: "Playa" }, expectedVersion: 3 });
    expect(filterValue(mock.log[0], "version")).toBe(3);
  });

  it("itinerary.reset is owner-only and regenerates days from the trip dates", async () => {
    await expect(runOp("itinerary.reset", member, { args: {} })).rejects.toMatchObject({ status: 403 });
    handler = (q) => {
      if (q.table === "rooms") return { data: { start_date: "2026-10-01", end_date: "2026-10-02" } };
      if (q.table === "trip_days") return { data: [] };
      if (q.op === "rpc") return { data: { days: [{ id: "d0", version: 2 }, { id: "d1", version: 1 }] } };
    };
    const result = await runOp("itinerary.reset", owner, { args: {} });
    const rpc = mock.log.find((q) => q.op === "rpc")!;
    expect(rpc.table).toBe("reset_itinerary");
    expect((rpc.args as { p_days: { id: string }[] }).p_days.map((d) => d.id)).toEqual(["d0", "d1"]);
    expect(result.changed).toHaveLength(2);
  });
});

describe("span ops", () => {
  it("daySpan.create checks the day, the limit and the referenced events", async () => {
    handler = (q) => {
      if (q.table === "trip_days") return { data: { id: "d0" } };
      if (q.table === "trip_day_spans" && q.op === "select") return { data: [{ position: 1 }] };
      if (q.table === "trip_events") return { data: filterValue(q, "id") === "e1" ? { id: "e1" } : null };
      if (q.op === "insert") return { data: { ...(q.values as object), version: 1 } };
    };
    const ok = await runOp("daySpan.create", member, { args: { dayId: "d0", startEventId: "e1", bg: "#fff", border: "#000" } });
    expect(ok.changed[0].row).toMatchObject({ position: 2, start_event_id: "e1" });
    await expect(
      runOp("daySpan.create", member, { args: { dayId: "d0", startEventId: "e9", bg: "#fff", border: "#000" } }),
    ).rejects.toThrow(DomainError);
  });

  it("daySpan.create refuses a day at the span limit", async () => {
    handler = (q) => {
      if (q.table === "trip_days") return { data: { id: "d0" } };
      if (q.table === "trip_day_spans") return { data: Array.from({ length: 50 }, (_, i) => ({ position: i })) };
    };
    await expect(runOp("daySpan.create", member, { args: { dayId: "d0", bg: "#fff", border: "#000" } })).rejects.toThrow(/50 spans/);
  });

  it("tripSpan.create requires both events to exist", async () => {
    handler = (q) => {
      if (q.table === "trip_spans") return { data: [] };
      if (q.table === "trip_events") return { data: filterValue(q, "id") === "e1" ? { id: "e1" } : null };
    };
    await expect(
      runOp("tripSpan.create", member, { args: { startEventId: "e1", endEventId: "e2", bg: "#fff", border: "#000" } }),
    ).rejects.toThrow(/e2/);
  });

  it("span deletes go through delete_trip_row", async () => {
    handler = () => ({ data: { deleted: { id: "t1" } } });
    const result = await runOp("tripSpan.delete", member, { args: { id: "t1" }, expectedVersion: 2 });
    expect(mock.log[0]).toMatchObject({ table: "delete_trip_row", args: { p_table: "trip_spans", p_expected_version: 2 } });
    expect(result.deleted).toEqual([{ table: "trip_spans", id: "t1" }]);
  });
});
