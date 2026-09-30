import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock, filterValue, type QueryHandler } from "@/test/supabaseMock";
import type { OpContext } from "@/server/ops/types";

let handler: QueryHandler = () => undefined;
let mock = createSupabaseMock((q) => handler(q));

vi.mock("@/lib/supabase-server", () => ({ createServerClient: () => mock.client }));

const { executeTool } = await import("@/server/agent/tools");

const ctx: OpContext = { code: "ABCD1234", userId: "u-owner", role: "owner" };
const meta = { room_code: "ABCD1234", updated_at: "t", updated_by: "u-owner" };
const event = { ...meta, id: "e1", day_id: "d0", position: 0, start_hour: 9, end_hour: 10, title: "Museo", cat: "tour", note: "", version: 1 };

beforeEach(() => {
  mock = createSupabaseMock((q) => handler(q));
});

describe("agent tools on the op registry", () => {
  it("reads come from get_trip, not rooms.payload", async () => {
    handler = (q) => (q.op === "rpc"
      ? { data: { code: "ABCD1234", members: [], updated_at: "t", payload: { days: [{ id: "d0", label: "Jue", events: [] }], extras: [] } } }
      : undefined);
    const outcome = await executeTool(ctx, "get_trip_overview", {});
    expect(outcome.isError).toBe(false);
    expect(mock.log.map((q) => q.table)).toEqual(["get_trip"]);
  });

  it("create_event runs event.create with the owner as author and hides row metadata", async () => {
    handler = (q) => {
      if (q.table === "trip_days") return { data: { id: "d0" } };
      if (q.table === "trip_events" && q.op === "select") return { data: [] };
      if (q.op === "insert") return { data: { ...event, ...(q.values as object) } };
    };
    const outcome = await executeTool(ctx, "create_event", { dayId: "d0", title: "Cena", start: 19, end: 21 });
    expect(outcome.isError).toBe(false);
    expect(mock.log.find((q) => q.op === "insert")?.values).toMatchObject({ updated_by: "u-owner", title: "Cena" });
    const body = JSON.parse(outcome.content);
    expect(body.changed[0]).toMatchObject({ table: "trip_events", title: "Cena" });
    expect(body.changed[0]).not.toHaveProperty("room_code");
  });

  it("update_event with a dayId moves the event, then edits its text", async () => {
    handler = (q) => {
      if (q.table === "trip_days") return { data: { id: "d1" } };
      if (q.table === "trip_events" && q.op === "select") return filterValue(q, "day_id") ? { data: [] } : { data: event };
      if (q.op === "update") return { data: { ...event, version: 2 } };
    };
    const outcome = await executeTool(ctx, "update_event", { eventId: "e1", dayId: "d1", title: "Museo del Oro" });
    expect(outcome.isError).toBe(false);
    const updates = mock.log.filter((q) => q.op === "update").map((q) => q.values);
    expect(updates).toEqual([
      expect.objectContaining({ day_id: "d1" }),
      expect.objectContaining({ title: "Museo del Oro" }),
    ]);
  });

  it("turns domain errors, conflicts and missing rows into tool errors", async () => {
    handler = () => ({ data: null });
    const missingDay = await executeTool(ctx, "create_event", { dayId: "d9", title: "A", start: 9, end: 10 });
    expect(missingDay).toMatchObject({ isError: true });
    expect(missingDay.content).toContain("d9");

    const gone = await executeTool(ctx, "update_task", { taskId: "k1", title: "x" });
    expect(gone.isError).toBe(true);
    expect(gone.content).toContain("no longer exists");

    handler = (q) => (q.op === "update" ? { data: null } : { data: { ...event, version: 4 } });
    const conflict = await executeTool(ctx, "update_event", { eventId: "e1", title: "x" });
    expect(conflict).toMatchObject({ isError: true });
    expect(conflict.content).toContain("changed by someone else");
  });

  it("still throws unexpected database errors", async () => {
    handler = () => ({ error: { code: "XX000", message: "boom" } });
    await expect(executeTool(ctx, "create_task", { title: "A" })).rejects.toThrow();
  });
});
