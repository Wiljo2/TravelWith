import Anthropic from "@anthropic-ai/sdk";
import { fmtHour } from "@/utils/time";
import { tripPlaces } from "@/utils/places";
import { distanceKm, eventKey, staleEvents } from "@/utils/tripGeo";
import { dayPhases } from "@/server/ideaPlan";
import { withPhotos } from "@/server/placePhotos";
import {
  coordsFromGoogleMapsUrl, findGoogleMapsLink, GOOGLE_MAPS_RE, isShortGoogleMapsLink, placeNameFromGoogleMapsUrl,
} from "@/utils/googleMaps";
import type { RoomPayload } from "@/hooks/useRoom";
import type { CalendarEvent, EventPlace } from "@/types";

// "Ubicar lugares" for the trip map. An activity with a Google Maps link uses
// that exact spot. For the rest, Claude reads the itinerary and says, for
// each activity, whether it happens at a fixed place (which one, with a precise
// search query and its best estimate of the coordinates), aboard the ship, or
// nowhere in particular. A geocoder (Photon, OpenStreetMap data, free) then
// finds the exact spot; its answer is used only when it lands near Claude's
// estimate, so a namesake in another city can't move a pin across the map.

const MODEL = process.env.IDEAS_MODEL ?? "claude-sonnet-5-5";
const MAX_EVENTS = 80;
const NEAR_KM = 8;
const GEOCODER = "https://photon.komoot.io/api/";

const SYSTEM = `Ubicas en un mapa las actividades del itinerario de un viaje en grupo. Para cada actividad (etiqueta e…) decide:

- kind "place": ocurre en un lugar fijo en tierra o en un puerto. Da "name" (nombre corto del lugar, ej. "Bayside Marketplace"), "query" (búsqueda precisa para un geocodificador: nombre del lugar, ciudad y estado o país, ej. "Bayside Marketplace, Miami, Florida") y tu mejor estimación de "lat" y "lng".
- kind "ship": ocurre a bordo del crucero (shows, buffet, piscina, cenas en el barco, drill).
- kind "none": no es un lugar (alistarse, empacar sin hotel claro, tiempo libre sin sitio).

Cómo decidir el lugar:
- Usa tu conocimiento del mundo y el contexto del día (ciudad, fase del viaje, hotel en el que están).
- Comidas o desayunos "en hotel" van al hotel de esos días. Un traslado o viaje en carro va a su destino.
- Un vuelo va al aeropuerto de llegada; "salida al aeropuerto" va al aeropuerto de salida.
- Zarpe, check-in del crucero, llegada y desembarque van a la terminal del puerto; un atraque va al muelle de cruceros de ese puerto.
- Una cadena sin dirección (Walgreens, Target, Starbucks) va a la sucursal más cercana a donde se hospedan ese día; en "query" incluye la calle o zona de esa sucursal.
- Una actividad con varias opciones ("STK / Wolfgang Puck") va al lugar que las reúne (el outlet, el centro comercial); si no hay uno claro, a la primera opción.
- Si no sabes dónde es con razonable seguridad, usa "none". No inventes lugares.
Para "ship" y "none" usa name y query vacíos y lat = lng = 0.`;

const SCHEMA = {
  type: "object",
  properties: {
    events: {
      type: "array",
      items: {
        type: "object",
        properties: {
          event: { type: "string" },
          kind: { type: "string", enum: ["place", "ship", "none"] },
          name: { type: "string" },
          query: { type: "string" },
          lat: { type: "number" },
          lng: { type: "number" },
        },
        required: ["event", "kind", "name", "query", "lat", "lng"],
        additionalProperties: false,
      },
    },
  },
  required: ["events"],
  additionalProperties: false,
};

export class GeocodeError extends Error {}

type Answer = { event: string; kind: EventPlace["kind"]; name: string; query: string; lat: number; lng: number };

// The prompt plus the label → event map. Pure, for tests. Only activities not
// located yet (or edited since) are asked about, minus `located` (found from
// their links); the others give context.
export function buildGeoPrompt(payload: RoomPayload, located: Record<string, EventPlace> = {}) {
  const days = payload.days ?? [];
  const places = tripPlaces(payload.trip?.destination, days, payload.ideaPlaces);
  const phases = dayPhases(days, places);
  const pending = new Set(staleEvents(days, payload.eventPlaces ?? {})
    .filter((ev) => !located[ev.id]).slice(0, MAX_EVENTS).map((ev) => ev.id));
  const labels = new Map<string, { id: string; key: string }>();
  let n = 0;
  const itinerary = days.map((day, i) => {
    const lines = [`${day.label}${day.sub ? ` · ${day.sub}` : ""} · ${phases[i]}`];
    for (const ev of [...day.events].sort((a, b) => a.start - b.start)) {
      const note = (ev.note ?? "")
        .replace(new RegExp(GOOGLE_MAPS_RE.source, "gi"), (url) => `[Google Maps: ${placeNameFromGoogleMapsUrl(url) ?? "link"}]`)
        .replace(/https?:\/\/\S+/g, "").replace(/\s+/g, " ").trim().slice(0, 120);
      const known = located[ev.id] ?? payload.eventPlaces?.[ev.id];
      let label = "  ";
      if (pending.has(ev.id)) {
        label = `e${++n}`;
        labels.set(label, { id: ev.id, key: eventKey(ev) });
      }
      const where = !pending.has(ev.id) && known?.kind === "place" && known.name ? ` [ubicado en: ${known.name}]` : "";
      lines.push(` ${label} ${fmtHour(ev.start)} ${ev.title}${note ? ` — ${note}` : ""}${where}`);
    }
    return lines.join("\n");
  }).join("\n");
  const user = `${payload.trip?.destination ? `Destino: ${payload.trip.destination}\n` : ""}ITINERARIO\n${itinerary}\n\n` +
    `Devuelve un elemento en "events" por cada actividad con etiqueta (e1, e2…).`;
  return { system: SYSTEM, user, labels, count: labels.size };
}

// A short link (maps.app.goo.gl) only has the spot once followed. Google may
// answer with its consent page, which carries the real URL in `continue`.
async function resolveLink(url: string): Promise<string> {
  if (!isShortGoogleMapsLink(url)) return url;
  try {
    const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(6000) });
    const final = new URL(res.url);
    return final.searchParams.get("continue") ?? res.url;
  } catch {
    return url;
  }
}

// Activities whose title or note has a Google Maps link with a readable spot.
export async function placesFromLinks(events: CalendarEvent[]): Promise<Record<string, EventPlace>> {
  const out: Record<string, EventPlace> = {};
  await Promise.all(events.map(async (ev) => {
    const link = findGoogleMapsLink(`${ev.title} ${ev.note ?? ""}`);
    if (!link) return;
    const url = await resolveLink(link);
    const at = coordsFromGoogleMapsUrl(url);
    if (!at) return;
    const name = placeNameFromGoogleMapsUrl(url);
    out[ev.id] = { key: eventKey(ev), kind: "place", name: name ?? ev.title, query: name, ...at, source: "link" };
  }));
  return out;
}

async function geocode(query: string, near: { lat: number; lng: number }): Promise<{ lat: number; lng: number } | null> {
  const url = `${GEOCODER}?q=${encodeURIComponent(query)}&limit=1&lat=${near.lat}&lon=${near.lng}`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": "TravelWith trip planner" }, signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const data = (await res.json()) as { features?: { geometry?: { coordinates?: [number, number] } }[] };
    const c = data.features?.[0]?.geometry?.coordinates;
    return c ? { lat: c[1], lng: c[0] } : null;
  } catch {
    return null;
  }
}

// Claude's estimate refined by the geocoder, a few lookups at a time.
export async function refine(answers: (Answer & { id: string; key: string })[]): Promise<Record<string, EventPlace>> {
  const out: Record<string, EventPlace> = {};
  for (let i = 0; i < answers.length; i += 4) {
    await Promise.all(answers.slice(i, i + 4).map(async (a) => {
      const valid = a.kind === "place" && Number.isFinite(a.lat) && Number.isFinite(a.lng) && (a.lat !== 0 || a.lng !== 0);
      if (!valid) {
        out[a.id] = { key: a.key, kind: a.kind === "place" ? "none" : a.kind };
        return;
      }
      const estimate = { lat: a.lat, lng: a.lng };
      const found = a.query ? await geocode(a.query, estimate) : null;
      const use = found && distanceKm(found, estimate) <= NEAR_KM ? found : null;
      out[a.id] = {
        key: a.key, kind: "place", name: a.name || undefined, query: a.query || undefined,
        ...(use ?? estimate), source: use ? "geocoder" : "claude",
      };
    }));
  }
  return out;
}

// Places located before photos existed get one.
function missingPhotos(payload: RoomPayload): Record<string, EventPlace> {
  return Object.fromEntries(Object.entries(payload.eventPlaces ?? {}).filter(([, p]) => p.kind === "place" && p.photo === undefined));
}

export async function locateEvents(payload: RoomPayload): Promise<{ places: Record<string, EventPlace>; usage: { input: number; output: number } }> {
  if (!process.env.ANTHROPIC_API_KEY) throw new GeocodeError("Falta ANTHROPIC_API_KEY en el servidor.");
  const fromLinks = await placesFromLinks(staleEvents(payload.days ?? [], payload.eventPlaces ?? {}));
  const prompt = buildGeoPrompt(payload, fromLinks);
  if (prompt.count === 0) return { places: await withPhotos({ ...missingPhotos(payload), ...fromLinks }), usage: { input: 0, output: 0 } };

  const response = await new Anthropic().messages.create({
    model: MODEL,
    max_tokens: 1000 + prompt.count * 120,
    system: prompt.system,
    messages: [{ role: "user", content: prompt.user }],
    output_config: { ...(MODEL.includes("haiku") ? {} : { effort: "low" as const }), format: { type: "json_schema", schema: SCHEMA } },
  });
  if (response.stop_reason === "refusal") throw new GeocodeError("El modelo no pudo ubicar estas actividades.");
  if (response.stop_reason === "max_tokens") throw new GeocodeError("Demasiadas actividades para ubicar de una vez.");
  const text = response.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text;
  if (!text) throw new GeocodeError("Respuesta vacía del modelo.");

  const answers = ((JSON.parse(text) as { events?: Answer[] }).events ?? [])
    .flatMap((a) => {
      const ev = prompt.labels.get(a.event?.trim());
      return ev ? [{ ...a, ...ev }] : [];
    });
  const places = await withPhotos({ ...missingPhotos(payload), ...fromLinks, ...(await refine(answers)) });
  return { places, usage: { input: response.usage.input_tokens, output: response.usage.output_tokens } };
}
