import { describe, it, expect, vi, beforeEach } from "vitest";
import { auth, params, request, resetDb, supabaseServerMock } from "@/test/routeHelpers";
import { filterValue, type RecordedQuery } from "@/test/supabaseMock";

vi.mock("@/lib/supabase-server", () => supabaseServerMock);

const route = await import("./route");
const { GET, DELETE } = route;

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

  it("reads the trip from the tables through get_trip", async () => {
    const trip = { ...ROOM, payload: { days: [{ id: "d0", label: "L", events: [], version: 3 }], extras: [] } };
    const db = resetDb((q) => membership("member")(q) ?? (q.op === "rpc" ? { data: trip } : undefined));
    const res = await GET(request("GET", "tok-member"), params("abc123"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.payload.days[0].version).toBe(3);
    expect(body.payload.exchangeRate).toBe(4000);
    expect(db.log.find((q) => q.op === "rpc")).toMatchObject({ table: "get_trip", args: { p_code: "ABC123" } });
    expect(db.log.some((q) => q.table === "rooms")).toBe(false);
  });

  it("answers 404 when the room does not exist", async () => {
    resetDb((q) => membership("member")(q) ?? (q.op === "rpc" ? { data: null } : undefined));
    const res = await GET(request("GET", "tok-member"), params("ABC123"));
    expect(res.status).toBe(404);
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
  it("no longer exists: trip writes go through /ops", () => {
    expect("PATCH" in route).toBe(false);
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
