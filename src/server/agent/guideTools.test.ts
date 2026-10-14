import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock, type QueryHandler } from "@/test/supabaseMock";
import type { OpContext } from "@/server/ops/types";
import type { Day, EventPlace, Idea, IdeaInsight, InsightLink, RoomPayload } from "@/types";
import { fmtDeadline } from "@/utils/insights";
import { distanceKm, fmtDistance } from "@/utils/tripGeo";

let handler: QueryHandler = () => undefined;
let mock = createSupabaseMock((q) => handler(q));

vi.mock("@/lib/supabase-server", () => ({ createServerClient: () => mock.client }));

const { AGENT_TOOLS, executeTool } = await import("@/server/agent/tools");
const { toolKind } = await import("@/server/agent/actions");

const ctx: OpContext = { code: "ABCD1234", userId: "u-owner", role: "owner" };
const ev = (id: string, title: string, start: number, end: number) => ({ id, title, start, end, cat: "tour", note: "" });
const days: Day[] = [
  { id: "d0", label: "Vie 13", sub: "", flexible: false, events: [
    ev("e1", "Museo", 9, 11), ev("e2", "Almuerzo", 12, 13), ev("e4", "Siesta", 15, 16), ev("e3", "Cena", 20, 22), ev("e5", "Show a bordo", 22, 23),
  ] },
  { id: "d1", label: "Sáb 14", sub: "", flexible: false, events: [ev("e6", "Playa", 10, 12)] },
];

function serve(payload: Partial<RoomPayload>) {
  handler = (q) => (q.op === "rpc"
    ? { data: { code: "ABCD1234", members: [], updated_at: "t", payload: { days, extras: [], exchangeRate: 4000, ...payload } } }
    : undefined);
}

async function run(name: string, input: Record<string, unknown> = {}) {
  const outcome = await executeTool(ctx, name, input);
  return { ...outcome, body: outcome.isError ? null : JSON.parse(outcome.content) };
}

const video = (id: string, insights: IdeaInsight[], extra: Partial<Idea> = {}): Idea => ({
  id, url: `https://vt.tiktok.com/${id}/`, platform: "tiktok", createdAt: "t", video: { status: "done", insights }, ...extra,
});

beforeEach(() => {
  mock = createSupabaseMock((q) => handler(q));
});

describe("guide tools", () => {
  it("are read tools offered last", () => {
    expect(AGENT_TOOLS.slice(-2).map((t) => t.name)).toEqual(["get_trip_guide", "get_places"]);
    expect(toolKind("get_trip_guide")).toBe("read");
    expect(toolKind("get_places")).toBe("read");
  });

  it("get_trip_guide places the advice, merges videos and skips hidden or not applicable items", async () => {
    const links: InsightLink[] = [
      { insightId: "v1:i0", before: true, deadline: "2026-11-01", status: "new" },
      { insightId: "v1:i1", dayId: "d1", eventId: "e6", status: "new" },
      { insightId: "v1:i3", status: "na" },
      { insightId: "v2:i1", dayId: "d0", eventId: "e1", status: "covered" },
    ];
    serve({
      ideas: [
        video("v1", [
          { kind: "todo", text: "Reservar las entradas del museo", when: "dos meses antes" },
          { kind: "tip", text: "Llegar temprano a la playa" },
          { kind: "avoid", text: "Evitar el restaurante del muelle" },
          { kind: "fact", text: "El parqueo cuesta veinte dólares" },
        ], { place: "Miami", insightStates: { 0: { votes: ["a", "b"] }, 2: { hidden: "dismissed" } } }),
        video("v2", [
          { kind: "tip", text: "Llegar temprano a la playa" },
          { kind: "tip", text: "Comprar el combo de museos" },
        ], { suggestion: { place: "Miami", source: "rules" } }),
        video("v3", [{ kind: "todo", text: "Tramitar la visa" }], { place: "Miami", status: "discarded" }),
      ],
      ideaPlaces: ["Miami"],
      insightLinks: links,
    });
    const { body } = await run("get_trip_guide");
    expect(body.count).toBe(3);
    expect(body).not.toHaveProperty("truncated");
    expect(body.insights).toEqual([
      { text: "Reservar las entradas del museo", kind: "todo", zone: "Miami", when: "dos meses antes", placement: "antes del viaje",
        votes: 2, videos: 1, deadline: fmtDeadline("2026-11-01") },
      { text: "Llegar temprano a la playa", kind: "tip", zone: "Miami", placement: "Sáb 14 · Playa", votes: 0, videos: 2 },
      { text: "Comprar el combo de museos", kind: "tip", zone: "Miami", placement: "Vie 13 · Museo", alreadyInPlan: true, votes: 0, videos: 1 },
    ]);
  });

  it("get_trip_guide caps the list and says so", async () => {
    const insights = Array.from({ length: 85 }, (_, n): IdeaInsight => ({ kind: "tip", text: `Visitar sitio${n}` }));
    serve({ ideas: [video("v1", insights)] });
    const { body } = await run("get_trip_guide");
    expect(body).toMatchObject({ count: 85, truncated: true });
    expect(body.insights).toHaveLength(80);
    expect(body.insights[0]).toMatchObject({ zone: "Sin lugar", votes: 0, videos: 1 });
  });

  it("get_places lists each day's stops in visit order with distances and unlocated activities", async () => {
    const place = (name: string, lat: number, lng: number): EventPlace => ({ key: name, kind: "place", name, lat, lng });
    const museum = { lat: 25.79012345, lng: -80.13012345 };
    const restaurant = { lat: 25.7617, lng: -80.1918 };
    serve({
      eventPlaces: {
        e1: place("Museo de Arte", museum.lat, museum.lng),
        e2: place("Café del museo", 25.79014, -80.13014),
        e3: place("Restaurante", restaurant.lat, restaurant.lng),
        e5: { key: "Show a bordo", kind: "ship" },
        e6: place("South Beach", 25.7826, -80.1341),
      },
    });
    const { body } = await run("get_places");
    expect(body.days).toHaveLength(2);
    expect(body.days[0]).toEqual({
      dayId: "d0",
      label: "Vie 13",
      stops: [
        { name: "Museo de Arte", lat: 25.7901, lng: -80.1301, events: [{ title: "Museo", start: 9 }, { title: "Almuerzo", start: 12 }] },
        { name: "Restaurante", lat: 25.7617, lng: -80.1918, events: [{ title: "Cena", start: 20 }],
          distanceFromPrevious: fmtDistance(distanceKm(museum, restaurant)) },
      ],
      unlocatedCount: 2,
    });

    const one = await run("get_places", { dayId: "d1" });
    expect(one.body.days.map((d: { dayId: string }) => d.dayId)).toEqual(["d1"]);
    expect(one.body.days[0]).toMatchObject({ stops: [{ name: "South Beach" }], unlocatedCount: 0 });
    expect(await run("get_places", { dayId: "d9" })).toMatchObject({ isError: true });
  });
});
