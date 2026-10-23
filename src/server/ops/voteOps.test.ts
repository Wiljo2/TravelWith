import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock, type QueryHandler } from "@/test/supabaseMock";
import type { OpContext } from "@/server/ops/types";

let handler: QueryHandler = () => undefined;
let mock = createSupabaseMock((q) => handler(q));

vi.mock("@/lib/supabase-server", () => ({ createServerClient: () => mock.client }));

const { runOp } = await import("@/server/ops");
const { RowConflictError, RowNotFoundError } = await import("@/server/repo/errors");

const ctx: OpContext = { code: "ABCD1234", userId: "u1", role: "member" };
const meta = { room_code: "ABCD1234", updated_at: "t", updated_by: null };
const task = { ...meta, id: "k1", version: 2, position: 0, title: "Hotel", done: false, note: null,
  day_id: null, start_hour: null, end_hour: null, cat: "decidir", priority: null, icon: null, decides: null };
const option = { ...meta, id: "o1", version: 3, task_id: "k1", position: 0, label: "A", note: null,
  amount: null, currency: null, split_mode: null, votes: ["u2"], start_date: null, end_date: null };

beforeEach(() => {
  mock = createSupabaseMock((q) => handler(q));
});

function answer(over: { task?: object | null; option?: object | null; rpc?: object } = {}): QueryHandler {
  return (q) => {
    if (q.op === "rpc") return { data: over.rpc ?? { ...option, votes: ["u2", "u1"], version: 4 } };
    if (q.table === "trip_tasks") return { data: over.task === undefined ? task : over.task };
    if (q.table === "trip_task_options") return { data: over.option === undefined ? option : over.option };
  };
}

describe("taskOption.vote", () => {
  it("votes as the signed-in member, never as a voter named in the args", async () => {
    handler = answer();
    const result = await runOp("taskOption.vote", ctx, { args: { id: "o1", on: true, voter: "u9", userId: "u9" } });
    const rpc = mock.log.find((q) => q.op === "rpc")!;
    expect(rpc).toMatchObject({ table: "set_task_option_vote", args: { p_code: "ABCD1234", p_option_id: "o1", p_on: true, p_user: "u1" } });
    expect(result.changed).toEqual([{ table: "trip_task_options", row: expect.objectContaining({ id: "o1", version: 4, votes: ["u2", "u1"] }) }]);
    expect(result.deleted).toEqual([]);
  });

  it("removes a vote and ignores the expected version", async () => {
    handler = answer({ rpc: { ...option, votes: null, version: 4 } });
    await runOp("taskOption.vote", ctx, { args: { id: "o1", on: false }, expectedVersion: 1 });
    const rpc = mock.log.find((q) => q.op === "rpc")!;
    expect(rpc.args).toEqual({ p_code: "ABCD1234", p_option_id: "o1", p_on: false, p_user: "u1" });
    expect(mock.log.some((q) => q.op === "update")).toBe(false);
  });

  it("validates the arguments", async () => {
    handler = answer();
    await expect(runOp("taskOption.vote", ctx, { args: { id: "o1" } })).rejects.toThrow(/on is required/);
    await expect(runOp("taskOption.vote", ctx, { args: { id: "o1", on: "yes" } })).rejects.toThrow(/on must be a boolean/);
    await expect(runOp("taskOption.vote", ctx, { args: { on: true } })).rejects.toThrow(/id is required/);
    expect(mock.log.some((q) => q.op === "rpc")).toBe(false);
  });

  it("refuses a missing option and a done task", async () => {
    handler = answer({ option: null });
    await expect(runOp("taskOption.vote", ctx, { args: { id: "o1", on: true } })).rejects.toBeInstanceOf(RowNotFoundError);
    handler = answer({ task: { ...task, done: true } });
    await expect(runOp("taskOption.vote", ctx, { args: { id: "o1", on: true } })).rejects.toThrow(/already done/);
    expect(mock.log.some((q) => q.op === "rpc")).toBe(false);
  });

  it("maps an option deleted meanwhile to a 404", async () => {
    handler = (q) => (q.op === "rpc" ? { error: { code: "P0002", message: "option not found" } } : answer()(q));
    await expect(runOp("taskOption.vote", ctx, { args: { id: "o1", on: true } })).rejects.toMatchObject({ status: 404 });
  });
});

describe("task.closeVote", () => {
  const owner: OpContext = { ...ctx, role: "owner" };
  const vote = { ...task, title: "¿Cuándo viajamos?", decides: "dates" };
  const dated = { ...option, start_date: "2026-11-26", end_date: "2026-11-28" };
  const header = { code: "ABCD1234", name: "Caribe", destination: null, start_date: "2026-11-26", end_date: "2026-11-28",
    exchange_rate: 4000, idea_places: null, idea_plan: null };
  const closed = { task: { ...vote, done: true, version: 3 }, days: [{ id: "d0", version: 2 }, { id: "d1", version: 1 }], trip: header };

  function closing(over: { task?: object; option?: object; events?: object[]; rpc?: object } = {}): QueryHandler {
    return (q) => {
      if (q.op === "rpc") return { data: over.rpc ?? closed };
      if (q.table === "trip_tasks") return { data: over.task ?? vote };
      if (q.table === "trip_task_options") return { data: over.option ?? dated };
      if (q.table === "trip_events") return { data: over.events ?? [] };
    };
  }

  it("is owner-only", async () => {
    handler = closing();
    await expect(runOp("task.closeVote", ctx, { args: { taskId: "k1", optionId: "o1" } })).rejects.toMatchObject({ status: 403 });
    expect(mock.log).toEqual([]);
  });

  it("sends the option's days to close_task_vote and returns the task, days and header", async () => {
    handler = closing();
    const result = await runOp("task.closeVote", owner, { args: { taskId: "k1", optionId: "o1" }, expectedVersion: 2 });
    const rpc = mock.log.find((q) => q.op === "rpc")!;
    expect(rpc).toMatchObject({
      table: "close_task_vote",
      args: { p_code: "ABCD1234", p_task_id: "k1", p_option_id: "o1", p_expected_version: 2, p_replace: false, p_user: "u1" },
    });
    expect((rpc.args as { p_days: { id: string }[] }).p_days.map((d) => d.id)).toEqual(["d0", "d1", "d2"]);
    expect(result.changed.map((c) => [c.table, c.row.id])).toEqual([["trip_tasks", "k1"], ["trip_days", "d0"], ["trip_days", "d1"]]);
    expect(result.trip).toEqual(header);
  });

  it("refuses to wipe activities without replaceItinerary", async () => {
    handler = closing({ events: [{ id: "e1" }, { id: "e2" }] });
    await expect(runOp("task.closeVote", owner, { args: { taskId: "k1", optionId: "o1" } })).rejects.toThrow(/2 activities.*replaceItinerary/);
    expect(mock.log.some((q) => q.op === "rpc")).toBe(false);
    await runOp("task.closeVote", owner, { args: { taskId: "k1", optionId: "o1", replaceItinerary: true } });
    expect(mock.log.find((q) => q.op === "rpc")!.args).toMatchObject({ p_replace: true });
  });

  it("a destination needs no days and doesn't look at the itinerary", async () => {
    handler = closing({ task: { ...vote, decides: "destination" }, option: { ...option, label: "Cartagena" }, rpc: { ...closed, days: null } });
    const result = await runOp("task.closeVote", owner, { args: { taskId: "k1", optionId: "o1" } });
    expect(mock.log.find((q) => q.op === "rpc")!.args).toMatchObject({ p_days: null });
    expect(mock.log.some((q) => q.table === "trip_events")).toBe(false);
    expect(result.changed.map((c) => c.table)).toEqual(["trip_tasks"]);
  });

  it("refuses regular tasks, closed votes and options of another task", async () => {
    handler = closing({ task: task });
    await expect(runOp("task.closeVote", owner, { args: { taskId: "k1", optionId: "o1" } })).rejects.toThrow(/not an open vote/);
    handler = closing({ task: { ...vote, done: true } });
    await expect(runOp("task.closeVote", owner, { args: { taskId: "k1", optionId: "o1" } })).rejects.toThrow(/not an open vote/);
    handler = closing({ option: { ...dated, task_id: "k2" } });
    await expect(runOp("task.closeVote", owner, { args: { taskId: "k1", optionId: "o1" } })).rejects.toThrow(/not found in task/);
  });

  it("maps a task that changed meanwhile to a conflict", async () => {
    handler = closing({ rpc: { conflict: true, current: { ...vote, version: 5 } } });
    await expect(runOp("task.closeVote", owner, { args: { taskId: "k1", optionId: "o1" }, expectedVersion: 2 }))
      .rejects.toBeInstanceOf(RowConflictError);
  });
});

describe("options of a vote", () => {
  const vote = { ...task, decides: "dates" };
  function options(over: { task?: object; list?: object[]; option?: object } = {}): QueryHandler {
    return (q) => {
      if (q.table === "trip_tasks") return { data: over.task ?? vote };
      if (q.table === "trip_task_options" && q.op === "select") return { data: q.single ? over.option ?? option : over.list ?? [] };
      if (q.op === "insert") return { data: { ...(q.values as object), version: 1 } };
      if (q.op === "rpc") return { data: { deleted: option } };
    };
  }

  it("a dates vote takes date ranges, at most five", async () => {
    handler = options();
    const result = await runOp("taskOption.create", ctx, { args: { taskId: "k1", label: "Nov 26 – 28", startDate: "2026-11-26", endDate: "2026-11-28" } });
    expect(result.changed[0].row).toMatchObject({ start_date: "2026-11-26", end_date: "2026-11-28", task_id: "k1" });
    await expect(runOp("taskOption.create", ctx, { args: { taskId: "k1", label: "Pronto" } })).rejects.toThrow(/need startDate/);
    handler = options({ list: Array.from({ length: 5 }, (_, i) => ({ position: i })) });
    await expect(runOp("taskOption.create", ctx, { args: { taskId: "k1", label: "B", startDate: "2026-11-26", endDate: "2026-11-28" } }))
      .rejects.toThrow(/5 options/);
  });

  it("a closed vote refuses new, edited and removed options", async () => {
    handler = options({ task: { ...vote, done: true } });
    await expect(runOp("taskOption.create", ctx, { args: { taskId: "k1", label: "B", startDate: "2026-11-26", endDate: "2026-11-28" } }))
      .rejects.toThrow(/closed/);
    await expect(runOp("taskOption.update", ctx, { args: { id: "o1", label: "C" } })).rejects.toThrow(/closed/);
    await expect(runOp("taskOption.delete", ctx, { args: { id: "o1" } })).rejects.toThrow(/closed/);
    expect(mock.log.some((q) => q.op === "insert" || q.op === "update" || q.op === "rpc")).toBe(false);
  });

  it("anyone removes an option of an open vote", async () => {
    handler = options();
    const result = await runOp("taskOption.delete", ctx, { args: { id: "o1" } });
    expect(result.deleted).toEqual([{ table: "trip_task_options", id: "o1" }]);
  });
});
