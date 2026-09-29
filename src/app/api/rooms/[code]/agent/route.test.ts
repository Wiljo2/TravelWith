import { describe, it, expect, vi, beforeEach } from "vitest";
import { auth, params, request, resetDb, supabaseServerMock } from "@/test/routeHelpers";
import type { RecordedQuery } from "@/test/supabaseMock";

vi.mock("@/lib/supabase-server", () => supabaseServerMock);

const { POST } = await import("./route");
const { AGENT_TOOLS, executeTool } = await import("@/server/agent/tools");

const body = { messages: [{ role: "user", content: "hola" }] };

function db(role: string, usedTokens = 0) {
  return (q: RecordedQuery) => {
    if (q.table === "user_rooms") return { data: { role } };
    if (q.table === "agent_usage") return { data: [{ input_tokens: usedTokens, output_tokens: 0 }] };
    return undefined;
  };
}

beforeEach(() => {
  process.env.ANTHROPIC_API_KEY ??= "test";
  auth.users = { tok: { id: "u1" } };
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

describe("agent tools (beta)", () => {
  it("does not offer destructive tools to the model", () => {
    const names = AGENT_TOOLS.map((t) => t.name);
    expect(names).toContain("create_event");
    for (const name of ["delete_event", "delete_task", "remove_expense", "set_exchange_rate"]) {
      expect(names).not.toContain(name);
    }
  });

  it("refuses a destructive call even if the model invents it", async () => {
    resetDb(() => ({ data: null }));
    const outcome = await executeTool("ABC123", "delete_event", { eventId: "e1" });
    expect(outcome.isError).toBe(true);
  });
});
