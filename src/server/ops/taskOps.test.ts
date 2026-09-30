import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock, filterValue, type QueryHandler } from "@/test/supabaseMock";
import type { OpContext } from "@/server/ops/types";

let handler: QueryHandler = () => undefined;
let mock = createSupabaseMock((q) => handler(q));

vi.mock("@/lib/supabase-server", () => ({ createServerClient: () => mock.client }));

const { runOp } = await import("@/server/ops");
const { RowConflictError } = await import("@/server/repo/errors");

const ctx: OpContext = { code: "ABCD1234", userId: "u1", role: "member" };
const meta = { room_code: "ABCD1234", updated_at: "t", updated_by: null };
const task = { ...meta, id: "k1", version: 2, position: 0, title: "Reservar", done: false, note: null,
  day_id: "d0", start_hour: 10, end_hour: 11, cat: null, priority: null };
const option = { ...meta, id: "o1", version: 1, task_id: "k1", position: 0, label: "A", note: null,
  amount: 50, currency: "USD", split_mode: "group" };

beforeEach(() => {
  mock = createSupabaseMock((q) => handler(q));
});

describe("task ops", () => {
  it("task.toggle flips done guarded by the version it read", async () => {
    handler = (q) => (q.op === "update" ? { data: { ...task, done: true, version: 3 } } : { data: task });
    await runOp("task.toggle", ctx, { args: { id: "k1" } });
    const update = mock.log.find((q) => q.op === "update")!;
    expect(update.values).toMatchObject({ done: true, version: 3 });
    expect(filterValue(update, "version")).toBe(2);
  });

  it("task.create checks the day when scheduling", async () => {
    handler = (q) => (q.table === "trip_tasks" ? { data: [] } : { data: null });
    await expect(runOp("task.create", ctx, { args: { title: "A", dayId: "d9" } })).rejects.toThrow(/d9/);
  });

  it("taskOption.create respects the per-task limit", async () => {
    handler = (q) => {
      if (q.table === "trip_tasks") return { data: task };
      if (q.table === "trip_task_options") return { data: Array.from({ length: 20 }, (_, i) => ({ position: i })) };
    };
    await expect(runOp("taskOption.create", ctx, { args: { taskId: "k1", label: "B" } })).rejects.toThrow(/20 options/);
  });
});

describe("task.chooseOption", () => {
  it("sends the built event and expense to choose_task_option and returns them", async () => {
    handler = (q) => {
      if (q.table === "trip_tasks") return { data: task };
      if (q.table === "trip_task_options") return { data: option };
      if (q.table === "trip_events") return { data: [] };
      if (q.op === "rpc") return { data: { event: { id: "e9", version: 1 }, expense: { id: "x9", version: 1 }, task } };
    };
    const result = await runOp("task.chooseOption", ctx, {
      args: { taskId: "k1", optionId: "o1", eventId: "e9", expenseId: "x9" },
      expectedVersion: 2,
    });
    const rpc = mock.log.find((q) => q.op === "rpc")!;
    expect(rpc).toMatchObject({
      table: "choose_task_option",
      args: { p_task_id: "k1", p_expected_version: 2, p_user: "u1", p_event: { id: "e9", cat: "logist" }, p_expense: { id: "x9", amount: 50 } },
    });
    expect(result.changed.map((c) => c.table)).toEqual(["trip_events", "trip_expenses"]);
    expect(result.deleted).toEqual([{ table: "trip_tasks", id: "k1" }]);
  });

  it("rejects an option from another task", async () => {
    handler = (q) => (q.table === "trip_tasks" ? { data: task } : { data: { ...option, task_id: "k2" } });
    await expect(runOp("task.chooseOption", ctx, { args: { taskId: "k1", optionId: "o1" } })).rejects.toThrow(/not found in task/);
  });

  it("maps a task that changed meanwhile to a conflict", async () => {
    handler = (q) => {
      if (q.table === "trip_tasks") return { data: task };
      if (q.table === "trip_task_options") return { data: option };
      if (q.table === "trip_events") return { data: [] };
      if (q.op === "rpc") return { data: { conflict: true, current: { ...task, version: 5 } } };
    };
    await expect(runOp("task.chooseOption", ctx, { args: { taskId: "k1", optionId: "o1" }, expectedVersion: 2 }))
      .rejects.toBeInstanceOf(RowConflictError);
  });
});
