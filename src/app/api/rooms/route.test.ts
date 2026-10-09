import { describe, it, expect, vi, beforeEach } from "vitest";
import { auth, db, request, resetDb, supabaseServerMock } from "@/test/routeHelpers";

vi.mock("@/lib/supabase-server", () => supabaseServerMock);

const { POST } = await import("./route");

const trip = { name: "Viaje", startDate: "2026-03-01", endDate: "2026-03-03" };

beforeEach(() => {
  auth.users = { tok: { id: "u1", user_metadata: { full_name: "Ana" } } };
});

describe("POST /api/rooms", () => {
  it("requires sign-in", async () => {
    resetDb(() => ({}));
    expect((await POST(request("POST", undefined, trip))).status).toBe(401);
  });

  it("creates the room in the trip tables with a 10-char code and registers the caller as owner", async () => {
    resetDb((q) => (q.op === "rpc" ? { data: q.table === "join_room" ? { joined: true, role: "owner" } : { days: [] } } : {}));
    const res = await POST(request("POST", "tok", trip));
    expect(res.status).toBe(201);
    const { code } = await res.json();
    expect(code).toMatch(/^[A-Z2-9]{10}$/);
    const join = db.mock.log.find((q) => q.op === "rpc" && q.table === "join_room")!;
    expect(join.args).toMatchObject({ p_code: code, p_user: "u1", p_role: "owner" });
    const insert = db.mock.log.find((q) => q.op === "insert")!;
    expect(insert.values).toEqual({
      code, name: "Viaje", destination: null, start_date: "2026-03-01", end_date: "2026-03-03", exchange_rate: 4000,
    });
    const reset = db.mock.log.find((q) => q.op === "rpc" && q.table === "reset_itinerary")!;
    expect(reset.args).toMatchObject({ p_code: code, p_user: "u1" });
    expect((reset.args as { p_days: { id: string }[] }).p_days.map((d) => d.id)).toEqual(["d0", "d1", "d2"]);
  });

  it("removes the room if the owner membership cannot be created", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    resetDb((q) => (q.op === "rpc" && q.table === "join_room" ? { error: { message: "boom" } } : {}));
    const res = await POST(request("POST", "tok", trip));
    expect(res.status).toBe(500);
    expect(db.mock.log.some((q) => q.op === "rpc" && q.table === "delete_room")).toBe(true);
  });

  it("removes the room if its days cannot be created", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    resetDb((q) => {
      if (q.op !== "rpc") return {};
      if (q.table === "reset_itinerary") return { error: { message: "boom" } };
      return { data: { joined: true, role: "owner" } };
    });
    const res = await POST(request("POST", "tok", trip));
    expect(res.status).toBe(500);
    expect(db.mock.log.some((q) => q.op === "rpc" && q.table === "delete_room")).toBe(true);
  });

  it("rejects invalid trips", async () => {
    resetDb(() => ({}));
    const res = await POST(request("POST", "tok", { ...trip, endDate: "2026-01-01" }));
    expect(res.status).toBe(400);
  });
});
