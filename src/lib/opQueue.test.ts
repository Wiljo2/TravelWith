import { describe, expect, it, vi } from "vitest";
import { OpQueue, opTarget, sendable, versionEntries, type OpQueueHandlers, type OpResponse } from "@/lib/opQueue";

interface Call {
  op: string;
  args: Record<string, unknown>;
  expectedVersion?: number;
  resolve: (r: OpResponse) => void;
}

function setup() {
  const calls: Call[] = [];
  const handlers: OpQueueHandlers = {
    onConflict: vi.fn(), onFailure: vi.fn(), onResync: vi.fn(), onTrip: vi.fn(), onRows: vi.fn(), onState: vi.fn(), onMaintenance: vi.fn(),
  };
  const queue = new OpQueue(
    (op, args, expectedVersion) => new Promise((resolve) => calls.push({ op, args, expectedVersion, resolve })),
    handlers,
    5,
  );
  return { queue, calls, handlers };
}

const flush = () => new Promise((r) => setTimeout(r, 0));
const ok = (changed: { table: string; row: { id: string; version: number } }[] = [], extra: object = {}) =>
  ({ status: 200, body: { changed, deleted: [], ...extra } });

describe("OpQueue", () => {
  it("runs ops on one item in order, each with the version the previous one returned", async () => {
    const { queue, calls } = setup();
    queue.seed([["trip_events:e1", 2]]);
    queue.send("event.update", { id: "e1", title: "a" });
    queue.send("event.delete", { id: "e1" });
    expect(calls).toHaveLength(1);
    expect(calls[0].expectedVersion).toBe(2);
    calls[0].resolve(ok([{ table: "trip_events", row: { id: "e1", version: 3 } }]));
    await flush();
    expect(calls[1]).toMatchObject({ op: "event.delete", expectedVersion: 3 });
  });

  it("merges queued updates of the same item while one is in flight", async () => {
    const { queue, calls } = setup();
    queue.send("event.update", { id: "e1", title: "a" });
    queue.send("event.update", { id: "e1", title: "ab" });
    queue.send("event.update", { id: "e1", title: "abc", note: "n" });
    calls[0].resolve(ok());
    await flush();
    expect(calls.map((c) => c.args)).toEqual([{ id: "e1", title: "a" }, { id: "e1", title: "abc", note: "n" }]);
  });

  it("runs different items in parallel and creates without a version", () => {
    const { queue, calls } = setup();
    queue.send("event.create", { id: "e2", dayId: "d0" });
    queue.send("expense.update", { id: "x1", amount: 5 });
    expect(calls.map((c) => [c.op, c.expectedVersion])).toEqual([["event.create", undefined], ["expense.update", undefined]]);
  });

  it("knows items being created and items from the loaded trip", async () => {
    const { queue, calls } = setup();
    queue.seed([["trip_task_options:o1", 1]]);
    expect(queue.isKnown("trip_task_options", "o1")).toBe(true);
    queue.send("taskOption.create", { id: "o2", taskId: "k1", label: "B" });
    expect(queue.isKnown("trip_task_options", "o2")).toBe(true);
    calls[0].resolve({ status: 400, body: { error: "x" } });
    await flush();
    expect(queue.isKnown("trip_task_options", "o2")).toBe(false);
  });

  it("on 409 adopts the current row and continues with its version", async () => {
    const { queue, calls, handlers } = setup();
    queue.seed([["trip_events:e1", 2]]);
    queue.send("event.update", { id: "e1", title: "mine" });
    queue.send("event.delete", { id: "e1" });
    const current = { id: "e1", title: "theirs", version: 7 };
    calls[0].resolve({ status: 409, body: { error: "conflict", table: "trip_events", current } });
    await flush();
    expect(handlers.onConflict).toHaveBeenCalledWith("trip_events", "e1", current);
    expect(calls[1].expectedVersion).toBe(7);
  });

  it("reports failures, resyncs after a reset and applies chooseOption rows", async () => {
    const { queue, calls, handlers } = setup();
    queue.send("expense.delete", { id: "x1" });
    calls[0].resolve({ status: 500, body: null });
    await flush();
    expect(handlers.onFailure).toHaveBeenCalledWith("expense.delete", 500);
    expect(handlers.onState).toHaveBeenLastCalledWith("error");

    queue.send("itinerary.reset", {});
    calls[1].resolve(ok());
    await flush();
    expect(handlers.onResync).toHaveBeenCalled();

    queue.send("task.chooseOption", { taskId: "k1", optionId: "o1" });
    const rows = [{ table: "trip_events", row: { id: "e9", version: 1 } }];
    calls[2].resolve(ok(rows));
    await flush();
    expect(handlers.onRows).toHaveBeenCalledWith(rows);
    expect(handlers.onState).toHaveBeenLastCalledWith("saved");
  });

  it("passes the trip header of header ops", async () => {
    const { queue, calls, handlers } = setup();
    queue.send("trip.setExchangeRate", { rate: 4100 });
    queue.send("trip.setExchangeRate", { rate: 4200 });
    calls[0].resolve(ok([], { trip: { exchange_rate: 4100 } }));
    await flush();
    expect(handlers.onTrip).toHaveBeenCalledWith({ exchange_rate: 4100 });
    expect(calls[1].args).toEqual({ rate: 4200 });
  });
});

describe("OpQueue during maintenance", () => {
  it("keeps a 503'd op, retries it later and merges edits made meanwhile", async () => {
    const { queue, calls, handlers } = setup();
    queue.send("event.update", { id: "e1", title: "a" });
    calls[0].resolve({ status: 503, body: { error: "mantenimiento", maintenance: true } });
    await flush();
    expect(handlers.onMaintenance).toHaveBeenCalledWith(true);
    expect(handlers.onFailure).not.toHaveBeenCalled();
    queue.send("event.update", { id: "e1", title: "ab" });
    await new Promise((r) => setTimeout(r, 20));
    expect(calls).toHaveLength(2);
    expect(calls[1].args).toEqual({ id: "e1", title: "ab" });
    calls[1].resolve(ok());
    await flush();
    expect(handlers.onMaintenance).toHaveBeenLastCalledWith(false);
    expect(handlers.onState).toHaveBeenLastCalledWith("saved");
  });
});

describe("OpQueue remote changes", () => {
  it("skips the echo of our own write and stale messages", async () => {
    const { queue, calls } = setup();
    queue.seed([["trip_events:e1", 2]]);
    queue.send("event.update", { id: "e1", title: "a" });
    expect(queue.acceptRemote("trip_events", "e1", 3, false)).toBe(false);
    calls[0].resolve(ok([{ table: "trip_events", row: { id: "e1", version: 3 } }]));
    await flush();
    expect(queue.acceptRemote("trip_events", "e1", 3, false)).toBe(false);
    expect(queue.acceptRemote("trip_events", "e1", 2, false)).toBe(false);
  });

  it("applies newer rows from others and uses their version for the next op", () => {
    const { queue, calls } = setup();
    queue.seed([["trip_events:e1", 2]]);
    expect(queue.acceptRemote("trip_events", "e1", 4, false)).toBe(true);
    expect(queue.acceptRemote("trip_events", "e9", 1, false)).toBe(true);
    queue.send("event.update", { id: "e1", title: "a" });
    expect(calls[0].expectedVersion).toBe(4);
    expect(queue.isKnown("trip_events", "e9")).toBe(true);
  });

  it("holds remote changes while the item has queued ops", () => {
    const { queue } = setup();
    queue.seed([["trip_expenses:x1", 1]]);
    queue.send("expense.update", { id: "x1", amount: 5 });
    queue.send("expense.update", { id: "x1", amount: 6 });
    expect(queue.acceptRemote("trip_expenses", "x1", 5, false)).toBe(false);
    expect(queue.acceptRemote("trip_expenses", "x1", 5, true)).toBe(false);
    expect(queue.idle()).toBe(false);
  });

  it("applies remote deletes and forgets the item", () => {
    const { queue } = setup();
    queue.seed([["trip_tasks:t1", 3]]);
    expect(queue.acceptRemote("trip_tasks", "t1", 3, true)).toBe(true);
    expect(queue.isKnown("trip_tasks", "t1")).toBe(false);
    expect(queue.idle()).toBe(true);
  });
});

describe("helpers", () => {
  it("opTarget keys ops by item, days or trip", () => {
    expect(opTarget("event.move", { id: "e1" }).key).toBe("trip_events:e1");
    expect(opTarget("task.chooseOption", { taskId: "k1" }).key).toBe("trip_tasks:k1");
    expect(opTarget("day.swap", { a: "d0", b: "d1" }).key).toBe("days");
    expect(opTarget("trip.update", { name: "x" }).key).toBe("trip");
  });

  it("sendable holds back empty required text", () => {
    expect(sendable({ id: "e1", title: " " })).toBeNull();
    expect(sendable({ id: "e1", title: "", note: "x" })).toEqual({ id: "e1", note: "x" });
  });

  it("versionEntries collects every item version", () => {
    const entries = versionEntries({
      days: [{ id: "d0", version: 1, events: [{ id: "e1", version: 2 }], spans: [{ id: "s1", version: 3 }] }],
      tasks: [{ id: "k1", version: 4, options: [{ id: "o1", version: 5 }] }],
      extras: [{ id: "x1" }],
    });
    expect(entries).toEqual([
      ["trip_days:d0", 1], ["trip_events:e1", 2], ["trip_day_spans:s1", 3], ["trip_tasks:k1", 4], ["trip_task_options:o1", 5],
    ]);
  });
});
