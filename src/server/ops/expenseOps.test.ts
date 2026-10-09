import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock, filterValue, type QueryHandler } from "@/test/supabaseMock";
import type { OpContext } from "@/server/ops/types";

let handler: QueryHandler = () => undefined;
let mock = createSupabaseMock((q) => handler(q));

vi.mock("@/lib/supabase-server", () => ({ createServerClient: () => mock.client }));

const { runOp } = await import("@/server/ops");

const ctx: OpContext = { code: "ABCD1234", userId: "u1", role: "member" };
const days = [{ id: "d0", position: 0 }, { id: "d1", position: 1 }];
const expense = { room_code: "ABCD1234", id: "x1", position: 0, label: "Hotel", amount: 300, currency: "USD",
  split_mode: "group", linked_event_id: null, start_day_id: null, end_day_id: null, version: 2, updated_at: "t", updated_by: null };

beforeEach(() => {
  mock = createSupabaseMock((q) => handler(q));
});

describe("expense ops", () => {
  it("expense.create appends, checks refs and records the user", async () => {
    handler = (q) => {
      if (q.table === "trip_expenses" && q.op === "select") return { data: [{ position: 4 }] };
      if (q.table === "trip_events") return { data: { id: "e1" } };
      if (q.table === "trip_days") return { data: days };
      if (q.op === "insert") return { data: { ...(q.values as object), version: 1 } };
    };
    const result = await runOp("expense.create", ctx, {
      args: { label: "Taxi", amount: 45000, currency: "COP", linkedEventId: "e1", startDayId: "d0", endDayId: "d1" },
    });
    expect(result.changed[0].row).toMatchObject({ position: 5, updated_by: "u1", linked_event_id: "e1" });
  });

  it("expense.create rejects a backwards day range and unknown days", async () => {
    handler = (q) => (q.table === "trip_days" ? { data: days } : { data: [] });
    await expect(runOp("expense.create", ctx, { args: { label: "A", amount: 1, startDayId: "d1", endDayId: "d0" } })).rejects.toThrow(/later day/);
    await expect(runOp("expense.create", ctx, { args: { label: "A", amount: 1, startDayId: "d9" } })).rejects.toThrow(/d9/);
  });

  it("expense.update validates the merged row and is version-guarded", async () => {
    handler = (q) => {
      if (q.table === "trip_expenses" && q.op === "select") return { data: { ...expense, start_day_id: "d1" } };
      if (q.table === "trip_days") return { data: days };
      if (q.op === "update") return { data: { ...expense, version: 3 } };
    };
    await expect(runOp("expense.update", ctx, { args: { id: "x1", endDayId: "d0" }, expectedVersion: 2 })).rejects.toThrow(/later day/);
    const result = await runOp("expense.update", ctx, { args: { id: "x1", endDayId: "d1" }, expectedVersion: 2 });
    expect(result.changed[0].row.version).toBe(3);
    expect(filterValue(mock.log.find((q) => q.op === "update")!, "version")).toBe(2);
  });

  it("trip.setExchangeRate updates the header and returns it", async () => {
    handler = (q) => (q.table === "rooms" ? { data: { code: "ABCD1234", exchange_rate: 4200 } } : undefined);
    const result = await runOp("trip.setExchangeRate", ctx, { args: { rate: 4200 } });
    expect(mock.log[0]).toMatchObject({ table: "rooms", op: "update", values: { exchange_rate: 4200 } });
    expect(result.trip?.exchange_rate).toBe(4200);
  });
});
