import { afterEach, describe, expect, it, vi } from "vitest";
import { auth, params, request, resetDb, supabaseServerMock } from "@/test/routeHelpers";

vi.mock("@/lib/supabase-server", () => supabaseServerMock);

const opsRoute = await import("@/app/api/rooms/[code]/ops/route");
const agentRoute = await import("@/app/api/rooms/[code]/agent/route");
const roomRoute = await import("@/app/api/rooms/[code]/route");
const roomsRoute = await import("@/app/api/rooms/route");

afterEach(() => {
  delete process.env.MAINTENANCE_MODE;
});

describe("MAINTENANCE_MODE=on", () => {
  it("answers every write route with 503, a Spanish message and Retry-After, before touching the database", async () => {
    process.env.MAINTENANCE_MODE = "on";
    auth.users = { tok: { id: "u1" } };
    const db = resetDb(() => ({ data: { role: "owner" } }));
    const responses = [
      await opsRoute.POST(request("POST", "tok", { op: "event.delete", args: { id: "e1" } }), params("ABCD1234")),
      await agentRoute.POST(request("POST", "tok", { messages: [{ role: "user", content: "hola" }] }), params("ABCD1234")),
      await roomRoute.DELETE(request("DELETE", "tok"), params("ABCD1234")),
      await roomsRoute.POST(request("POST", "tok", { name: "Viaje", startDate: "2026-10-01", endDate: "2026-10-02" })),
    ];
    for (const res of responses) {
      expect(res.status).toBe(503);
      expect(res.headers.get("Retry-After")).toBe("30");
      const body = await res.json();
      expect(body).toMatchObject({ maintenance: true });
      expect(body.error).toContain("Estamos actualizando");
    }
    expect(db.log).toHaveLength(0);
  });

  it("keeps reads available", async () => {
    process.env.MAINTENANCE_MODE = "on";
    auth.users = { tok: { id: "u1" } };
    resetDb((q) => (q.table === "user_rooms" ? { data: { role: "member" } } : { data: { code: "ABCD1234", payload: { days: [], extras: [] }, members: [], updated_at: "t" } }));
    const res = await roomRoute.GET(request("GET", "tok"), params("ABCD1234"));
    expect(res.status).toBe(200);
  });

  it("is off unless the variable is exactly 'on'", async () => {
    process.env.MAINTENANCE_MODE = "true";
    auth.users = {};
    resetDb(() => undefined);
    const res = await opsRoute.POST(request("POST", undefined, { op: "event.delete", args: { id: "e1" } }), params("ABCD1234"));
    expect(res.status).toBe(401);
  });
});
