import { describe, it, expect, vi, beforeEach } from "vitest";
import { auth, db, params, request, resetDb, supabaseServerMock } from "@/test/routeHelpers";

vi.mock("@/lib/supabase-server", () => supabaseServerMock);

const { POST, DELETE } = await import("./route");

beforeEach(() => {
  auth.users = {
    tok: { id: "u1", email: "ana@example.com", user_metadata: { full_name: "Ana", avatar_url: "https://evil.example/pixel.png" } },
  };
});

describe("POST /api/rooms/[code]/members (join)", () => {
  it("requires sign-in", async () => {
    resetDb(() => ({ data: { joined: true, role: "member" } }));
    expect((await POST(request("POST"), params("ABC123"))).status).toBe(401);
  });

  it("always joins as member, even if the body asks for owner", async () => {
    resetDb(() => ({ data: { joined: true, role: "member" } }));
    const res = await POST(request("POST", "tok", { role: "owner" }), params("ABC123"));
    expect(res.status).toBe(200);
    const rpc = db.mock.log.find((q) => q.op === "rpc")!;
    expect(rpc.table).toBe("join_room");
    expect(rpc.args).toMatchObject({ p_code: "ABC123", p_user: "u1", p_role: "member", p_name: "Ana", p_avatar: null });
  });

  it("answers 404 for unknown rooms", async () => {
    resetDb(() => ({ data: { joined: false } }));
    expect((await POST(request("POST", "tok"), params("ABC123"))).status).toBe(404);
  });
});

describe("DELETE /api/rooms/[code]/members (leave)", () => {
  it("returns 404 and deletes nothing for non-members", async () => {
    resetDb(() => ({ data: { left: false } }));
    const res = await DELETE(request("DELETE", "tok"), params("ABC123"));
    expect(res.status).toBe(404);
    expect(db.mock.log.filter((q) => q.op !== "rpc")).toHaveLength(0);
  });

  it("reports whether the room was garbage-collected", async () => {
    resetDb(() => ({ data: { left: true, roomDeleted: true } }));
    const res = await DELETE(request("DELETE", "tok"), params("ABC123"));
    expect(await res.json()).toEqual({ ok: true, roomDeleted: true });
  });
});
