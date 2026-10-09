import { describe, it, expect, vi, beforeEach } from "vitest";
import { auth, params, request, resetDb, supabaseServerMock } from "@/test/routeHelpers";
import type { RecordedQuery } from "@/test/supabaseMock";

vi.mock("@/lib/supabase-server", () => supabaseServerMock);

const model = vi.hoisted(() => ({ queue: [] as unknown[], calls: [] as { messages: unknown[] }[] }));

vi.mock("@anthropic-ai/sdk", () => {
  class APIError extends Error {}
  class RateLimitError extends APIError {}
  class APIConnectionError extends APIError {}
  class Anthropic {
    static APIError = APIError;
    static RateLimitError = RateLimitError;
    static APIConnectionError = APIConnectionError;
    messages = {
      stream: (params: { messages: unknown[] }) => {
        model.calls.push({ messages: structuredClone(params.messages) });
        const message = model.queue.shift() as { content: { type: string; text?: string }[] };
        const handlers: Record<string, (d: string) => void> = {};
        return {
          on: (event: string, cb: (d: string) => void) => { handlers[event] = cb; },
          finalMessage: async () => {
            for (const b of message.content) if (b.type === "text") handlers.text?.(b.text ?? "");
            return message;
          },
        };
      },
    };
  }
  return { default: Anthropic };
});

const { POST } = await import("./route");
const { AGENT_TOOLS, executeTool } = await import("@/server/agent/tools");
const { signPending } = await import("@/server/agent/pending");

const body = { messages: [{ role: "user", content: "hola" }] };

function db(role: string, usedTokens = 0) {
  return (q: RecordedQuery) => {
    if (q.table === "user_rooms") return { data: { role } };
    if (q.table === "agent_usage") return { data: [{ input_tokens: usedTokens, output_tokens: 0 }] };
    return undefined;
  };
}

type Use = { id: string; name: string; input: object };

const usage = { input_tokens: 1, output_tokens: 1 };
const toolTurn = (...uses: Use[]) => ({
  stop_reason: "tool_use",
  usage,
  content: [{ type: "thinking", thinking: "t", signature: "sig" }, ...uses.map((u) => ({ type: "tool_use", ...u }))],
});
const textTurn = (text: string) => ({ stop_reason: "end_turn", usage, content: [{ type: "text", text }] });

const trip = {
  code: "ABC123",
  members: [],
  updated_at: "t",
  payload: { days: [{ id: "d0", label: "Jue 1", events: [{ id: "e1", title: "Museo", start: 9, end: 10 }] }], extras: [] },
};
const eventRow = {
  room_code: "ABC123", updated_at: "t", updated_by: "u1", id: "e1", day_id: "d0", position: 0,
  start_hour: 9, end_hour: 10, title: "Museo", cat: "tour", note: "", version: 1,
};

function tripDb() {
  return (q: RecordedQuery) => {
    if (q.table === "user_rooms") return { data: { role: "owner" } };
    if (q.table === "agent_usage") return q.op === "select" ? { data: [] } : undefined;
    if (q.table === "get_trip") return { data: trip };
    if (q.table === "trip_days") return { data: { id: "d0" } };
    if (q.table === "trip_events" && q.op === "select") return { data: q.single ? eventRow : [] };
    if (q.op === "insert") return { data: { ...eventRow, ...(q.values as object) } };
    if (q.op === "delete") return { data: eventRow };
    return undefined;
  };
}

const tripWrites = (log: RecordedQuery[]) =>
  log.filter((q) => q.table.startsWith("trip_") && ["insert", "update", "delete", "upsert"].includes(q.op));

async function frames(res: Response): Promise<Record<string, unknown>[]> {
  const text = await res.text();
  return text.split("\n\n").filter(Boolean).map((l) => JSON.parse(l.replace(/^data: /, "")));
}

const create: Use = { id: "tu_c", name: "create_event", input: { dayId: "d0", title: "Cena", start: 19, end: 21 } };
const del: Use = { id: "tu_d", name: "delete_event", input: { eventId: "e1" } };
const overview: Use = { id: "tu_r", name: "get_trip_overview", input: {} };

async function propose(...uses: Use[]) {
  model.queue.push(toolTurn(...uses));
  const out = await frames(await POST(request("POST", "tok", body), params("ABC123")));
  const confirm = out.find((f) => f.type === "confirm") as { token: string; actions: unknown[] };
  return { out, confirm };
}

const resume = (token: string, decisions: { id: string; approve: boolean }[]) =>
  POST(request("POST", "tok", { resume: { token, decisions } }), params("ABC123"));

type ToolResult = { tool_use_id: string; content: string; is_error?: boolean };
const lastResults = () =>
  (model.calls.at(-1)!.messages.at(-1) as { role: string; content: ToolResult[] }).content;

beforeEach(() => {
  process.env.ANTHROPIC_API_KEY ??= "test";
  auth.users = { tok: { id: "u1" } };
  model.queue = [];
  model.calls = [];
});

describe("POST /api/rooms/[code]/agent", () => {
  it("rejects anonymous callers before calling the model", async () => {
    auth.users = {};
    resetDb(() => ({ data: null }));
    const res = await POST(request("POST", undefined, body), params("ABC123"));
    expect(res.status).toBe(401);
  });

  it("is limited to the trip owner during the beta", async () => {
    resetDb(db("member"));
    const res = await POST(request("POST", "tok", body), params("ABC123"));
    expect(res.status).toBe(403);
  });

  it("stops at the daily token quota", async () => {
    resetDb(db("owner", 10_000_000));
    const res = await POST(request("POST", "tok", body), params("ABC123"));
    expect(res.status).toBe(429);
  });

  it("rejects user messages over the length limit", async () => {
    resetDb(db("owner"));
    const long = { messages: [{ role: "user", content: "x".repeat(4001) }] };
    const res = await POST(request("POST", "tok", long), params("ABC123"));
    expect(res.status).toBe(400);
  });
});

describe("agent human-in-the-loop", () => {
  it("pauses a write proposal without touching the database", async () => {
    const mock = resetDb(tripDb());
    const { out, confirm } = await propose(create);
    expect(confirm.actions).toEqual([
      { id: "tu_c", name: "create_event", kind: "write", summary: expect.stringContaining("Crear actividad") },
    ]);
    expect(out.map((f) => f.type)).toEqual(["confirm", "done"]);
    expect(tripWrites(mock.log)).toEqual([]);
  });

  it("runs reads of a mixed turn but holds the delete", async () => {
    const mock = resetDb(tripDb());
    const { out, confirm } = await propose(overview, del);
    expect(out.map((f) => f.type)).toEqual(["tool", "confirm", "done"]);
    expect(confirm.actions).toHaveLength(1);
    expect(confirm.actions[0]).toMatchObject({ id: "tu_d", kind: "delete" });
    expect(tripWrites(mock.log)).toEqual([]);
  });

  it("executes an approved action and answers the model with every tool result", async () => {
    const mock = resetDb(tripDb());
    const { confirm } = await propose(overview, create);
    model.queue.push(textTurn("Listo"));
    const out = await frames(await resume(confirm.token, [{ id: "tu_c", approve: true }]));
    expect(tripWrites(mock.log).map((q) => q.op)).toEqual(["insert"]);
    expect(out.map((f) => f.type)).toEqual(["tool", "text", "done"]);
    const results = lastResults();
    expect(results.map((c) => c.tool_use_id).sort()).toEqual(["tu_c", "tu_r"]);
    expect(results.find((c) => c.tool_use_id === "tu_c")?.is_error).toBeUndefined();
  });

  it("reports a rejected action as an error and writes nothing", async () => {
    const mock = resetDb(tripDb());
    const { confirm } = await propose(del);
    model.queue.push(textTurn("Entendido"));
    const out = await frames(await resume(confirm.token, [{ id: "tu_d", approve: false }]));
    expect(out.map((f) => f.type)).toEqual(["text", "done"]);
    expect(tripWrites(mock.log)).toEqual([]);
    expect(lastResults()[0]).toMatchObject({ is_error: true, content: expect.stringContaining("rejected") });
  });

  it("treats a missing decision as a rejection", async () => {
    const mock = resetDb(tripDb());
    const { confirm } = await propose(create, del);
    model.queue.push(textTurn("ok"));
    await frames(await resume(confirm.token, [{ id: "tu_c", approve: true }]));
    expect(tripWrites(mock.log).map((q) => q.op)).toEqual(["insert"]);
    expect(lastResults().find((c) => c.tool_use_id === "tu_d")?.is_error).toBe(true);
  });

  it("can pause again after a resume", async () => {
    resetDb(tripDb());
    const { confirm } = await propose(create);
    model.queue.push(toolTurn(del));
    const out = await frames(await resume(confirm.token, [{ id: "tu_c", approve: true }]));
    expect(out.map((f) => f.type)).toEqual(["tool", "confirm", "done"]);
  });

  describe("invalid tokens", () => {
    const state = {
      code: "ABC123",
      userId: "u1",
      messages: [],
      reads: [],
      toolUses: [{ id: "tu_c", name: "create_event", input: {} }],
      actions: [],
    };

    async function rejects(token: string) {
      const mock = resetDb(tripDb());
      const res = await resume(token, [{ id: "tu_c", approve: true }]);
      expect(res.status).toBe(400);
      expect(model.calls).toHaveLength(0);
      expect(tripWrites(mock.log)).toEqual([]);
    }

    it("rejects a tampered token", async () => {
      const [payload, sig] = signPending(state).split(".");
      const data = JSON.parse(Buffer.from(payload, "base64url").toString());
      const forged = Buffer.from(JSON.stringify({ ...data, toolUses: [] })).toString("base64url");
      await rejects(`${forged}.${sig}`);
    });

    it("rejects an expired token", async () => {
      await rejects(signPending(state, Date.now() - 20 * 60 * 1000));
    });

    it("rejects a token issued to another user", async () => {
      await rejects(signPending({ ...state, userId: "u2" }));
    });

    it("rejects a malformed resume body", async () => {
      resetDb(tripDb());
      const res = await POST(request("POST", "tok", { resume: { token: "x", decisions: "yes" } }), params("ABC123"));
      expect(res.status).toBe(400);
    });
  });

  it("offers destructive tools to the model and executes them when called", async () => {
    const names = AGENT_TOOLS.map((t) => t.name);
    for (const name of ["delete_event", "delete_task", "remove_expense", "set_exchange_rate"]) {
      expect(names).toContain(name);
    }
    resetDb(tripDb());
    const outcome = await executeTool({ code: "ABC123", userId: "u1", role: "owner" }, "delete_event", { eventId: "e1" });
    expect(outcome.isError).toBe(false);
    expect(JSON.parse(outcome.content).deleted).toEqual([{ table: "trip_events", id: "e1" }]);
  });
});
