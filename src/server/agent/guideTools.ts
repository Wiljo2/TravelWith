import type Anthropic from "@anthropic-ai/sdk";
import { readTrip, schema, type Input } from "@/server/agent/shared";
import { requireDay } from "@/server/domain/core";
import type { OpContext } from "@/server/ops/types";
import type { Day, Idea, InsightLink, RoomPayload } from "@/types";
import { collectInsights, fmtDeadline, placedInsights, type DigestInsight } from "@/utils/insights";
import { tripPlaces, zonesOf } from "@/utils/places";
import { distanceKm, fmtDistance, mapStops, type MapStop } from "@/utils/tripGeo";

// What the saved videos advise and where it fits the plan, and the trip map's
// stops: read-only views built from the trip, like the Ideas tab and the map.

const MAX_GUIDE = 80;
const NO_ZONE = "Sin lugar";
const BEFORE_TRIP = "antes del viaje";

export const GUIDE_TOOLS: Anthropic.Tool[] = [
  {
    name: "get_trip_guide",
    description:
      "Get the advice from the group's saved videos (kind: todo, tip, avoid, fact), the same advice from several videos counted once, by zone: where each piece fits the plan (a day and activity, or before the trip), whether the plan already covers it, votes, how many videos say it and any deadline. Includes advice nobody voted yet. Call this before suggesting what to book, prepare or avoid, or when the user asks what the videos recommend.",
    input_schema: schema({}),
  },
  {
    name: "get_places",
    description:
      "Get each day's located stops in visit order: name, coordinates, the activities held there and the straight-line distance from the previous stop, plus how many of the day's activities have no location. Pass dayId for one day. Call this for questions about routes, distances or where activities are.",
    input_schema: schema({ dayId: { type: "string", description: "Day id from get_trip_overview (optional)" } }),
  },
];

export const GUIDE_TOOL_LABELS: Record<string, string> = {
  get_trip_guide: "Revisando la guía del viaje",
  get_places: "Revisando el mapa",
};

const round4 = (n: number) => Math.round(n * 10_000) / 10_000;

function placement(item: DigestInsight, link: InsightLink | undefined, days: Day[]): string | undefined {
  if (link?.before || (!link?.dayId && item.insight.phase === "before")) return BEFORE_TRIP;
  const day = link?.dayId ? days.find((d) => d.id === link.dayId) : undefined;
  if (!day) return undefined;
  const event = link?.eventId ? day.events.find((e) => e.id === link.eventId) : undefined;
  return event ? `${day.label} · ${event.title}` : day.label;
}

function tripGuide(payload: RoomPayload) {
  const ideas = payload.ideas ?? [];
  const links = payload.insightLinks ?? [];
  const places = tripPlaces(payload.trip?.destination, payload.days, payload.ideaPlaces);
  const names = new Set(places.map((p) => p.name));
  const zones = zonesOf(places);
  const zoneOf = (i: Idea) => {
    const place = [i.place, i.suggestion?.place].find((p) => p && names.has(p));
    return place ? zones.get(place) ?? place : NO_ZONE;
  };
  const placed = new Map(placedInsights(ideas, links).map((p) => [p.id, p.link]));

  const entries = [...collectInsights(ideas, zoneOf, links)].flatMap(([zone, digest]) =>
    digest.insights
      .filter((item) => !item.state?.hidden && item.link?.status !== "na")
      .map((item) => {
        const link = item.ids.map((id) => placed.get(id)).find(Boolean) ?? item.link;
        return {
          text: item.insight.text,
          kind: item.insight.kind,
          zone,
          when: item.insight.when,
          placement: placement(item, link, payload.days),
          alreadyInPlan: link?.status === "covered" || undefined,
          votes: item.state?.votes?.length ?? 0,
          videos: item.sources.length,
          deadline: link?.deadline ? fmtDeadline(link.deadline) : undefined,
        };
      }),
  );
  entries.sort((a, b) => b.votes - a.votes || b.videos - a.videos);
  return {
    count: entries.length,
    ...(entries.length > MAX_GUIDE ? { truncated: true } : {}),
    insights: entries.slice(0, MAX_GUIDE),
  };
}

// A day's route: consecutive activities at the same stop share one entry.
function dayPlaces(day: Day, stops: MapStop[]) {
  const visits = stops
    .flatMap((stop) => stop.visits.filter((v) => v.dayId === day.id).map((v) => ({ stop, v })))
    .sort((a, b) => a.v.start - b.v.start);
  const route: { stop: MapStop; events: { title: string; start: number }[] }[] = [];
  for (const { stop, v } of visits) {
    const last = route[route.length - 1];
    if (last?.stop === stop) last.events.push({ title: v.title, start: v.start });
    else route.push({ stop, events: [{ title: v.title, start: v.start }] });
  }
  return {
    dayId: day.id,
    label: day.label,
    stops: route.map(({ stop, events }, n) => ({
      name: stop.name,
      lat: round4(stop.lat),
      lng: round4(stop.lng),
      events,
      distanceFromPrevious: n > 0 ? fmtDistance(distanceKm(route[n - 1].stop, stop)) : undefined,
    })),
    unlocatedCount: day.events.length - visits.length,
  };
}

export function isGuideTool(name: string): boolean {
  return GUIDE_TOOLS.some((t) => t.name === name);
}

export async function runGuideTool(ctx: OpContext, name: string, input: Input): Promise<unknown> {
  const { payload } = await readTrip(ctx.code);
  if (name === "get_trip_guide") return tripGuide(payload);
  const days = typeof input.dayId === "string" ? [requireDay(payload, input.dayId)] : payload.days;
  const stops = mapStops(payload.days, payload.eventPlaces ?? {});
  return { days: days.map((d) => dayPlaces(d, stops)) };
}
