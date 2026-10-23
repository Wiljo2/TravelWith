import { describe, it, expect, vi, beforeEach } from "vitest";
import { auth, db, request, resetDb, supabaseServerMock } from "@/test/routeHelpers";
import type { QueryHandler } from "@/test/supabaseMock";
import { LIMITS } from "@/constants/limits";

vi.mock("@/lib/supabase-server", () => supabaseServerMock);

const { POST } = await import("./route");

const trip = { name: "Viaje", startDate: "2026-03-01", endDate: "2026-03-03" };

const created: QueryHandler = (q) => (q.op === "rpc" ? { data: q.table === "join_room" ? { joined: true, role: "owner" } : { days: [] } } : {});
const inserts = (table: string) => db.mock.log.filter((q) => q.op === "insert" && q.table === table);

beforeEach(() => {
  auth.users = { tok: { id: "u1", user_metadata: { full_name: "Ana" } } };
});

describe("POST /api/rooms", () => {
  it("requires sign-in", async () => {
    resetDb(() => ({}));
    expect((await POST(request("POST", undefined, trip))).status).toBe(401);
  });

  it("creates the room in the trip tables with a 10-char code and registers the caller as owner", async () => {
    resetDb(created);
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
    expect(inserts("trip_travelers")).toHaveLength(0);
    expect(inserts("trip_tasks")).toHaveLength(0);
  });

  it("seeds placeholder travelers and starter tasks in one insert per table", async () => {
    resetDb(created);
    const res = await POST(request("POST", "tok", {
      ...trip,
      travelers: ["Viajero 2", " Viajero 3 "],
      tasks: [
        { title: "Reservar vuelos", cat: "reservar", priority: "alta", dayId: "d0" },
        { title: "Reservar alojamiento" },
      ],
    }));
    expect(res.status).toBe(201);
    const { code } = await res.json();

    const [travelers] = inserts("trip_travelers");
    expect(travelers.values).toEqual([
      { id: expect.any(String), position: 0, name: "Viajero 2", room_code: code, updated_by: "u1" },
      { id: expect.any(String), position: 1, name: "Viajero 3", room_code: code, updated_by: "u1" },
    ]);
    const [tasks] = inserts("trip_tasks");
    expect(tasks.values).toEqual([
      expect.objectContaining({
        position: 0, title: "Reservar vuelos", cat: "reservar", priority: "alta", done: false, day_id: null, room_code: code, updated_by: "u1",
      }),
      expect.objectContaining({ position: 1, title: "Reservar alojamiento", cat: null, priority: null, day_id: null }),
    ]);
  });

  it("accepts the traveler limit and empty seed lists", async () => {
    resetDb(created);
    const travelers = Array.from({ length: LIMITS.travelers }, (_, i) => `Viajero ${i + 2}`);
    expect((await POST(request("POST", "tok", { ...trip, travelers, tasks: [] }))).status).toBe(201);
    expect((inserts("trip_travelers")[0].values as unknown[]).length).toBe(LIMITS.travelers);
    expect(inserts("trip_tasks")).toHaveLength(0);
  });

  it.each([
    ["too many travelers", { travelers: Array.from({ length: LIMITS.travelers + 1 }, (_, i) => `Viajero ${i + 2}`) }],
    ["too many tasks", { tasks: Array.from({ length: LIMITS.starterTasks + 1 }, (_, i) => ({ title: `Tarea ${i}` })) }],
    ["travelers that are not a list", { travelers: "Viajero 2" }],
    ["a traveler that is not a name", { travelers: [42] }],
    ["an empty traveler name", { travelers: ["  "] }],
    ["a task that is not an object", { tasks: ["Reservar vuelos"] }],
    ["a task without a title", { tasks: [{ cat: "reservar" }] }],
    ["a task with an unknown category", { tasks: [{ title: "Reservar vuelos", cat: "otra" }] }],
    ["a task with an unknown priority", { tasks: [{ title: "Reservar vuelos", priority: "urgente" }] }],
  ])("rejects %s before creating the room", async (_, seed) => {
    resetDb(created);
    const res = await POST(request("POST", "tok", { ...trip, ...seed }));
    expect(res.status).toBe(400);
    expect(db.mock.log).toHaveLength(0);
  });

  it("removes the room if its seed rows cannot be created", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    resetDb((q) => (q.op === "insert" && q.table === "trip_tasks" ? { error: { message: "boom" } } : created(q)));
    const res = await POST(request("POST", "tok", { ...trip, travelers: ["Viajero 2"], tasks: [{ title: "Reservar vuelos" }] }));
    expect(res.status).toBe(500);
    expect(db.mock.log.some((q) => q.op === "rpc" && q.table === "delete_room")).toBe(true);
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
