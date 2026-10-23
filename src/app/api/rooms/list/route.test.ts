import { describe, it, expect, vi, beforeEach } from "vitest";
import { auth, request, resetDb, supabaseServerMock } from "@/test/routeHelpers";

vi.mock("@/lib/supabase-server", () => supabaseServerMock);

const { GET } = await import("./route");

const membership = (code: string) => ({ room_code: code, role: "member", joined_at: "2026-10-01", last_active_at: "2026-10-02" });

beforeEach(() => {
  auth.users = { tok: { id: "u1" } };
});

describe("GET /api/rooms/list", () => {
  it("requires a signed-in user", async () => {
    resetDb(() => undefined);
    expect((await GET(request("GET"))).status).toBe(401);
  });

  it("builds each trip from the header columns and drops rooms that no longer exist", async () => {
    resetDb((q) => {
      if (q.table === "user_rooms") return { data: [membership("NEWROOM123"), membership("NODATES123"), membership("GONE000000")] };
      if (q.table === "rooms") {
        return {
          data: [
            { code: "NEWROOM123", name: "Japón 2027", destination: "Tokio · Kioto", start_date: "2027-03-25", end_date: "2027-04-06" },
            { code: "NODATES123", name: "Sin fechas", destination: null, start_date: null, end_date: null },
          ],
        };
      }
      return undefined;
    });
    const res = await GET(request("GET", "tok"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.map((t: { code: string }) => t.code)).toEqual(["NEWROOM123", "NODATES123"]);
    expect(body[0]).toMatchObject({
      name: "Japón 2027",
      trip: { name: "Japón 2027", destination: "Tokio · Kioto", startDate: "2027-03-25", endDate: "2027-04-06" },
    });
    expect(body[1]).toMatchObject({ name: "Sin fechas", trip: null });
  });

  it("returns an empty list without querying rooms when the user has no trips", async () => {
    const mock = resetDb((q) => (q.table === "user_rooms" ? { data: [] } : undefined));
    const res = await GET(request("GET", "tok"));
    expect(await res.json()).toEqual([]);
    expect(mock.log.some((q) => q.table === "rooms")).toBe(false);
  });
});
