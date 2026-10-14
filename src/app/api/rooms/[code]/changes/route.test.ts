import { describe, it, expect, vi, beforeEach } from "vitest";
import { auth, db, params, request, resetDb, supabaseServerMock } from "@/test/routeHelpers";
import { filterValue, type RecordedQuery } from "@/test/supabaseMock";

vi.mock("@/lib/supabase-server", () => supabaseServerMock);

const { GET } = await import("./route");

const change = (id: number, over: object = {}) => ({
  id, table_name: "trip_events", row_id: "e1", op: "UPDATE", user_id: "u1", created_at: "2026-10-09T05:10:00Z",
  before: { id: "e1", title: "Museo", note: "", version: 1, updated_at: "a" },
  after: { id: "e1", title: "Museo", note: "Llevar agua", version: 2, updated_at: "b" },
  ...over,
});

function handler(member: boolean, changes: unknown[]) {
  return (q: RecordedQuery) => {
    if (q.table === "user_rooms") return { data: member ? { role: "member" } : null };
    if (q.table === "rooms") return { data: { members: [{ userId: "u1", name: "Ana", joinedAt: "x" }] } };
    if (q.table === "trip_changes") return { data: changes };
    if (q.table === "auth.users") {
      return filterValue(q, "id") === "left" ? { data: { id: "left", user_metadata: { full_name: "Luis" } } } : { error: { message: "User not found" } };
    }
    return undefined;
  };
}

beforeEach(() => {
  auth.users = { tok: { id: "u1" } };
});

describe("GET /api/rooms/[code]/changes", () => {
  it("is only for members", async () => {
    resetDb(handler(false, []));
    expect((await GET(request("GET"), params("ABC123"))).status).toBe(401);
    expect((await GET(request("GET", "tok"), params("ABC123"))).status).toBe(403);
    expect(db.mock.log.some((q) => q.table === "trip_changes")).toBe(false);
  });

  it("returns readable entries with the author's name and hides version-only updates", async () => {
    const versionOnly = change(2, { before: { id: "e1", version: 1 }, after: { id: "e1", version: 2 } });
    resetDb(handler(true, [change(3), versionOnly, change(1, { op: "DELETE", after: null, user_id: "gone" })]));
    const res = await GET(request("GET", "tok"), params("ABC123"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.next).toBeNull();
    expect(body.entries).toEqual([
      { id: 3, table: "trip_events", rowId: "e1", op: "UPDATE", at: "2026-10-09T05:10:00Z", userName: "Ana", label: "Museo", fields: ["note"] },
      { id: 1, table: "trip_events", rowId: "e1", op: "DELETE", at: "2026-10-09T05:10:00Z", userName: null, label: "Museo", fields: [] },
    ]);
    const q = db.mock.log.find((x) => x.table === "trip_changes")!;
    expect(filterValue(q, "room_code")).toBe("ABC123");
  });

  it("names people who left the trip from their account; deleted accounts stay unnamed", async () => {
    resetDb(handler(true, [change(3, { user_id: "left" }), change(2, { user_id: "gone" }), change(1)]));
    const body = await (await GET(request("GET", "tok"), params("ABC123"))).json();
    expect(body.entries.map((e: { userName: string | null }) => e.userName)).toEqual(["Luis", null, "Ana"]);
    const lookups = db.mock.log.filter((q) => q.table === "auth.users").map((q) => filterValue(q, "id"));
    expect(lookups.sort()).toEqual(["gone", "left"]);
  });

  it("pages with ?before and rejects bad values", async () => {
    resetDb(handler(true, []));
    const req = (qs: string) => new Request(`http://localhost/api?${qs}`, { headers: { Authorization: "Bearer tok" } });
    expect((await GET(req("before=40"), params("ABC123"))).status).toBe(200);
    expect(filterValue(db.mock.log.find((x) => x.table === "trip_changes")!, "id")).toBe(40);
    expect((await GET(req("before=abc"), params("ABC123"))).status).toBe(400);
  });
});
