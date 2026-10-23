import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock, type QueryHandler } from "@/test/supabaseMock";
import type { OpContext } from "@/server/ops/types";

let handler: QueryHandler = () => undefined;
let mock = createSupabaseMock((q) => handler(q));

vi.mock("@/lib/supabase-server", () => ({ createServerClient: () => mock.client }));

const { runOp } = await import("@/server/ops");
const { RowNotFoundError } = await import("@/server/repo/errors");

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
