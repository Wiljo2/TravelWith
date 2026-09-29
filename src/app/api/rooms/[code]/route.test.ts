import { describe, it, expect, vi, beforeEach } from "vitest";
import { auth, params, request, resetDb, supabaseServerMock } from "@/test/routeHelpers";
import { filterValue, type RecordedQuery } from "@/test/supabaseMock";

vi.mock("@/lib/supabase-server", () => supabaseServerMock);

const { GET, PATCH, DELETE } = await import("./route");

const ROOM = { code: "ABC123", payload: { days: [], extras: [], exchangeRate: 4000 }, members: [], updated_at: "t1" };

function membership(role: string | null) {
  return (q: RecordedQuery) => {
    if (q.table !== "user_rooms" || q.op !== "select") return undefined;
    return { data: role && filterValue(q, "user_id") === "u-member" ? { role } : null };
  };
}

beforeEach(() => {
  auth.users = { "tok-member": { id: "u-member" }, "tok-stranger": { id: "u-stranger" } };
});

describe("GET /api/rooms/[code]", () => {
  it("rejects requests without a token", async () => {
    resetDb(() => ({ data: ROOM }));
    const res = await GET(request("GET"), params("abc123"));
    expect(res.status).toBe(401);
  });

  it("rejects signed-in users who are not members", async () => {
    resetDb((q) => membership("member")(q) ?? { data: ROOM });
    const res = await GET(request("GET", "tok-stranger"), params("ABC123"));
    expect(res.status).toBe(403);
  });

  it("returns the room to members", async () => {
    resetDb((q) => membership("member")(q) ?? { data: ROOM });
    const res = await GET(request("GET", "tok-member"), params("ABC123"));
    expect(res.status).toBe(200);
    expect((await res.json()).code).toBe("ABC123");
  });

  it("rejects malformed codes before touching the database", async () => {
    resetDb(() => ({ data: ROOM }));
    const res = await GET(request("GET", "tok-member"), params("no!"));
    expect(res.status).toBe(400);
  });

  it("hides database error details", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    resetDb((q) => membership("member")(q) ?? { error: { message: "relation rooms does not exist" } });
    const res = await GET(request("GET", "tok-member"), params("ABC123"));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("relation");
  });
});

describe("PATCH /api/rooms/[code]", () => {
  const body = { days: [], extras: [], exchangeRate: 4000 };

  it("rejects non-members", async () => {
    resetDb((q) => membership("member")(q) ?? { data: { updated_at: "t2" } });
    const res = await PATCH(request("PATCH", "tok-stranger", body), params("ABC123"));
    expect(res.status).toBe(403);
  });

  it("saves for members", async () => {
    resetDb((q) => membership("member")(q) ?? { data: { updated_at: "t2" } });
    const res = await PATCH(request("PATCH", "tok-member", body), params("ABC123"));
    expect(res.status).toBe(200);
    expect((await res.json()).updated_at).toBe("t2");
  });
});

describe("DELETE /api/rooms/[code]", () => {
  it("is owner only", async () => {
    resetDb((q) => membership("member")(q) ?? {});
    const res = await DELETE(request("DELETE", "tok-member"), params("ABC123"));
    expect(res.status).toBe(403);
  });

  it("lets the owner delete", async () => {
    resetDb((q) => membership("owner")(q) ?? {});
    const res = await DELETE(request("DELETE", "tok-member"), params("ABC123"));
    expect(res.status).toBe(200);
  });
});
