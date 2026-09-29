import { describe, it, expect, vi } from "vitest";
import { auth, params, request, resetDb, supabaseServerMock } from "@/test/routeHelpers";

vi.mock("@/lib/supabase-server", () => supabaseServerMock);

const { POST } = await import("./route");

const body = { messages: [{ role: "user", content: "hola" }] };

describe("POST /api/rooms/[code]/agent", () => {
  it("rejects anonymous callers before calling the model", async () => {
    auth.users = {};
    resetDb(() => ({ data: null }));
    const res = await POST(request("POST", undefined, body), params("ABC123"));
    expect(res.status).toBe(401);
  });

  it("rejects user messages over the length limit", async () => {
    process.env.ANTHROPIC_API_KEY ??= "test";
    auth.users = { tok: { id: "u1" } };
    resetDb(() => ({ data: { role: "owner" } }));
    const long = { messages: [{ role: "user", content: "x".repeat(4001) }] };
    const res = await POST(request("POST", "tok", long), params("ABC123"));
    expect(res.status).toBe(400);
  });

  it("is limited to the trip owner during the beta", async () => {
    auth.users = { tok: { id: "u1" } };
    resetDb(() => ({ data: { role: "member" } }));
    const res = await POST(request("POST", "tok", body), params("ABC123"));
    expect(res.status).toBe(403);
  });
});
