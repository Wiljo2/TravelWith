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
  const body = { days: [], extras: [], exchangeRate: 4000, expectedUpdatedAt: "t1" };

  // Stored version is "t1": updates guarded on another version match no row.
  const store = (q: RecordedQuery) => {
    if (q.table !== "rooms") return undefined;
    if (q.op === "update") return { data: filterValue(q, "updated_at") === "t1" ? { updated_at: "t2" } : null };
    if (q.op === "select") return { data: { payload: ROOM.payload, members: [], updated_at: "t1" } };
  };
  const db = (q: RecordedQuery) => membership("member")(q) ?? store(q);

  it("rejects non-members", async () => {
    resetDb(db);
    const res = await PATCH(request("PATCH", "tok-stranger", body), params("ABC123"));
    expect(res.status).toBe(403);
  });

  it("saves for members on the current version", async () => {
    resetDb(db);
    const res = await PATCH(request("PATCH", "tok-member", body), params("ABC123"));
    expect(res.status).toBe(200);
    expect((await res.json()).updated_at).toBe("t2");
  });

  it("answers 409 with the current state instead of overwriting a newer version", async () => {
    resetDb(db);
    const res = await PATCH(request("PATCH", "tok-member", { ...body, expectedUpdatedAt: "t0" }), params("ABC123"));
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ updated_at: "t1", payload: ROOM.payload });
  });

  it("requires the version the edit was based on", async () => {
    resetDb(db);
    const { expectedUpdatedAt: _, ...unversioned } = body;
    const res = await PATCH(request("PATCH", "tok-member", unversioned), params("ABC123"));
    expect(res.status).toBe(400);
  });

  it("rejects payloads that would crash clients", async () => {
    resetDb(db);
    const res = await PATCH(request("PATCH", "tok-member", { ...body, days: [null] }), params("ABC123"));
    expect(res.status).toBe(400);
  });

  it("rejects bodies over the size limit", async () => {
    resetDb(db);
    const huge = { ...body, extras: [{ id: "x", label: "L", amount: 1, blob: "x".repeat(600 * 1024) }] };
    const res = await PATCH(request("PATCH", "tok-member", huge), params("ABC123"));
    expect(res.status).toBe(413);
  });

  it("enforces the full schema by default", async () => {
    resetDb(db);
    const bad = { ...body, extras: [{ id: "x", label: "L".repeat(300), amount: 1 }] };
    const res = await PATCH(request("PATCH", "tok-member", bad), params("ABC123"));
    expect(res.status).toBe(400);
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
