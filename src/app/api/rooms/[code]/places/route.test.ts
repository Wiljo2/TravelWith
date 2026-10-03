import { describe, it, expect, vi, beforeEach } from "vitest";
import { auth, params, request, resetDb, supabaseServerMock } from "@/test/routeHelpers";
import type { RecordedQuery } from "@/test/supabaseMock";

vi.mock("@/lib/supabase-server", () => supabaseServerMock);

const { POST } = await import("./route");

function db(role: string | null, usedTokens = 0) {
  return (q: RecordedQuery) => {
    if (q.table === "user_rooms") return { data: role ? { role } : null };
    if (q.table === "agent_usage") return { data: [{ input_tokens: usedTokens, output_tokens: 0 }] };
    return undefined;
  };
}

beforeEach(() => {
  auth.users = { tok: { id: "u1" } };
});

describe("POST /api/rooms/[code]/places", () => {
  it("requires sign-in", async () => {
    resetDb(db("member"));
    expect((await POST(request("POST", undefined, {}), params("ABC123"))).status).toBe(401);
  });

  it("rejects non-members", async () => {
    resetDb(db(null));
    expect((await POST(request("POST", "tok", {}), params("ABC123"))).status).toBe(403);
  });

  it("counts against the daily assistant quota", async () => {
    resetDb(db("member", 10_000_000));
    expect((await POST(request("POST", "tok", {}), params("ABC123"))).status).toBe(429);
  });
});
