import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock, filterValue, type QueryHandler } from "@/test/supabaseMock";
import type { OpContext } from "@/server/ops/types";

let handler: QueryHandler = () => undefined;
let mock = createSupabaseMock((q) => handler(q));

vi.mock("@/lib/supabase-server", () => ({ createServerClient: () => mock.client }));

const { AGENT_TOOLS, TOOL_LABELS, executeTool } = await import("@/server/agent/tools");

const ctx: OpContext = { code: "ABCD1234", userId: "u-owner", role: "owner" };
const meta = { room_code: "ABCD1234", updated_at: "t", updated_by: null };
const task = { ...meta, id: "k1", version: 2, position: 0, title: "Reservar tour", done: false, note: null,
  day_id: "d0", start_hour: 10, end_hour: 12, cat: null, priority: null };
const option = { ...meta, id: "o1", version: 1, task_id: "k1", position: 0, label: "Tour A", note: null,
  amount: 50, currency: "USD", split_mode: "perPerson" };
const header = { code: "ABCD1234", name: "Viaje", destination: "Miami", start_date: "2026-11-26", end_date: "2026-11-30",
  exchange_rate: 4000, idea_places: null, idea_plan: { links: [] } };

const inserted = (q: { values?: unknown }) => ({ data: { ...meta, version: 1, ...(q.values as object) } });
const body = (content: string) => JSON.parse(content);

beforeEach(() => {
  mock = createSupabaseMock((q) => handler(q));
});

describe("trip tools", () => {
  it("are offered after the idea tools, with Spanish labels", () => {
    const names = AGENT_TOOLS.map((t) => t.name);
    const added = ["get_task_options", "add_task_option", "choose_task_option", "create_events", "add_traveler", "remove_traveler", "update_trip"];
    expect(names.slice(names.indexOf("add_idea") + 1, names.indexOf("add_idea") + 1 + added.length)).toEqual(added);
    for (const name of added) expect(TOOL_LABELS[name]).toBeTruthy();
  });

  it("get_task_options lists options with their group total in USD", async () => {
    handler = (q) => (q.op === "rpc" ? { data: {
      code: "ABCD1234", updated_at: "t",
      members: [{ userId: "u-owner", name: "Laura", joinedAt: "t" }],
      payload: {
        days: [], extras: [], exchangeRate: 4000, mockPeople: [{ id: "p1", name: "Ana" }, { id: "p2", name: "Luis" }],
        tasks: [
          { id: "k1", title: "Reservar tour", done: false, dayId: "d0", options: [
            { id: "o1", label: "Tour A", amount: 50, splitMode: "perPerson" },
            { id: "o2", label: "Tour B", amount: 400000, currency: "COP", note: "con almuerzo" },
            { id: "o3", label: "Por nuestra cuenta" },
          ] },
          { id: "k2", title: "Comprar SIM", done: false },
        ],
      },
    } } : undefined);
    const all = body((await executeTool(ctx, "get_task_options", {})).content);
    expect(all.people).toBe(3);
    expect(all.tasks).toHaveLength(1);
    expect(all.tasks[0]).toMatchObject({ taskId: "k1", title: "Reservar tour", dayId: "d0" });
    expect(all.tasks[0].options).toEqual([
      { optionId: "o1", label: "Tour A", amount: 50, currency: "USD", splitMode: "perPerson", groupUSD: 150 },
      { optionId: "o2", label: "Tour B", note: "con almuerzo", amount: 400000, currency: "COP", splitMode: "group", groupUSD: 100 },
      { optionId: "o3", label: "Por nuestra cuenta", currency: "USD", splitMode: "group", groupUSD: 0 },
    ]);

    const one = body((await executeTool(ctx, "get_task_options", { taskId: "k2" })).content);
    expect(one.tasks).toEqual([{ taskId: "k2", title: "Comprar SIM", options: [] }]);
    expect(await executeTool(ctx, "get_task_options", { taskId: "zz" })).toMatchObject({ isError: true });
  });

  it("add_task_option runs taskOption.create", async () => {
    handler = (q) => {
      if (q.table === "trip_tasks") return { data: task };
      if (q.table === "trip_task_options" && q.op === "select") return { data: [option] };
      if (q.op === "insert") return inserted(q);
    };
    const outcome = await executeTool(ctx, "add_task_option", { taskId: "k1", label: "Tour B", amount: 60, splitMode: "perPerson" });
    expect(outcome.isError).toBe(false);
    expect(mock.log.find((q) => q.op === "insert")).toMatchObject({
      table: "trip_task_options",
      values: { task_id: "k1", label: "Tour B", amount: 60, split_mode: "perPerson", position: 1, updated_by: "u-owner" },
    });
    expect(body(outcome.content).changed[0]).not.toHaveProperty("room_code");
  });

  it("choose_task_option runs task.chooseOption with only the task and option ids", async () => {
    handler = (q) => {
      if (q.table === "trip_tasks") return { data: task };
      if (q.table === "trip_task_options") return { data: option };
      if (q.table === "trip_events") return { data: [] };
      if (q.op === "rpc") return { data: { event: { id: "e9", version: 1 }, expense: { id: "x9", version: 1 }, task } };
    };
    const outcome = await executeTool(ctx, "choose_task_option", { taskId: "k1", optionId: "o1", eventId: "from-model" });
    expect(outcome.isError).toBe(false);
    const rpc = mock.log.find((q) => q.op === "rpc")!;
    expect(rpc).toMatchObject({ table: "choose_task_option", args: { p_task_id: "k1", p_user: "u-owner" } });
    expect((rpc.args as { p_event: { id: string } }).p_event.id).not.toBe("from-model");
    expect(body(outcome.content).deleted).toEqual([{ table: "trip_tasks", id: "k1" }]);
  });

  it("create_events creates in order and stops at the first failure", async () => {
    handler = (q) => {
      if (q.table === "trip_days") return { data: filterValue(q, "id") === "d0" ? { id: "d0" } : null };
      if (q.table === "trip_events" && q.op === "select") return { data: [] };
      if (q.op === "insert") return inserted(q);
    };
    const outcome = await executeTool(ctx, "create_events", { events: [
      { dayId: "d0", title: "Museo", start: 9, end: 11 },
      { dayId: "d0", title: "Almuerzo", start: 12, end: 13 },
      { dayId: "d9", title: "Cena", start: 20, end: 22 },
      { dayId: "d0", title: "Playa", start: 15, end: 17 },
    ] });
    expect(outcome.isError).toBe(false);
    const result = body(outcome.content);
    expect(result.created.map((c: { index: number; title: string }) => [c.index, c.title])).toEqual([[0, "Museo"], [1, "Almuerzo"]]);
    expect(result.created[0].eventId).toEqual(expect.any(String));
    expect(result.failed).toEqual({ index: 2, error: expect.stringContaining("d9") });
    expect(mock.log.filter((q) => q.op === "insert")).toHaveLength(2);
  });

  it("create_events reports success with failed: null and rejects empty or oversized batches", async () => {
    handler = (q) => {
      if (q.table === "trip_days") return { data: { id: "d0" } };
      if (q.table === "trip_events" && q.op === "select") return { data: [] };
      if (q.op === "insert") return inserted(q);
    };
    const ok = body((await executeTool(ctx, "create_events", { events: [{ dayId: "d0", title: "Museo", start: 9, end: 11 }] })).content);
    expect(ok).toMatchObject({ created: [{ index: 0, title: "Museo" }], failed: null });

    expect(await executeTool(ctx, "create_events", { events: [] })).toMatchObject({ isError: true });
    const tooMany = Array.from({ length: 21 }, () => ({ dayId: "d0", title: "A", start: 9, end: 10 }));
    const outcome = await executeTool(ctx, "create_events", { events: tooMany });
    expect(outcome).toMatchObject({ isError: true });
    expect(outcome.content).toContain("20");
  });

  it("add_traveler and remove_traveler run the traveler ops", async () => {
    handler = (q) => {
      if (q.table === "trip_travelers" && q.op === "select") return { data: [] };
      if (q.op === "insert") return inserted(q);
      if (q.op === "rpc") return { data: { deleted: { id: "p1", version: 1 } } };
    };
    expect((await executeTool(ctx, "add_traveler", { name: " Ana " })).isError).toBe(false);
    expect(mock.log.find((q) => q.op === "insert")).toMatchObject({ table: "trip_travelers", values: { name: "Ana", position: 0 } });

    const removed = await executeTool(ctx, "remove_traveler", { travelerId: "p1" });
    expect(mock.log.find((q) => q.op === "rpc")).toMatchObject({ table: "delete_trip_row", args: { p_table: "trip_travelers", p_id: "p1" } });
    expect(body(removed.content).deleted).toEqual([{ table: "trip_travelers", id: "p1" }]);
  });

  it("update_trip changes only the name and destination, never the dates", async () => {
    handler = (q) => (q.op === "update" ? { data: { ...header, name: "Caribe" } } : { data: header });
    const outcome = await executeTool(ctx, "update_trip", { name: "Caribe", destination: "Miami y Bahamas", startDate: "2026-12-01", endDate: "2026-12-09" });
    expect(outcome.isError).toBe(false);
    expect(mock.log.find((q) => q.op === "update")?.values).toEqual({ name: "Caribe", destination: "Miami y Bahamas" });
    expect(body(outcome.content).trip).toEqual({
      name: "Caribe", destination: "Miami", start_date: "2026-11-26", end_date: "2026-11-30", exchange_rate: 4000,
    });

    const datesOnly = await executeTool(ctx, "update_trip", { startDate: "2026-12-01" });
    expect(datesOnly).toMatchObject({ isError: true });
    expect(mock.log.filter((q) => q.op === "update")).toHaveLength(1);
  });
});
