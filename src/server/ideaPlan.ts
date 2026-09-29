import Anthropic from "@anthropic-ai/sdk";
import { IDEA_TYPES } from "@/constants/ideaTypes";
import { fmtHour } from "@/utils/time";
import { freeSlots } from "@/utils/ideaPlan";
import { normalizeText, vocab } from "@/utils/ideas";
import { transcriptExcerpt } from "@/utils/excerpt";
import { isVenue, tripPlaces, type TripPlace } from "@/utils/places";
import type { RoomPayload } from "@/hooks/useRoom";
import type { Idea, IdeaLink } from "@/types";

// "Analizar con Claude": one cheap call (Haiku) that reads the itinerary, the
// trip's places and the ideas (with the relevant part of what each video says),
// and says where each idea fits, with a one-line reason. The model only picks
// among labeled options (activities, free gaps, days), so it can't invent ids or
// times; every answer is validated against the plan.
//
// Token budget: ids are short labels (i3, e12, s2, D4) instead of UUIDs — they
// also appear in the output, which costs 5x the input — and transcripts are cut
// to the opening plus the passages that mention the trip (transcriptExcerpt).

const MODEL = process.env.IDEAS_MODEL ?? "claude-haiku-4-5";
const MAX_IDEAS = 60;
const TRANSCRIPT_CHARS = 700;     // ~170 tokens per video
const TRANSCRIPT_WITH_NOTE = 400; // the member's note already says what it's about

const SYSTEM = `Eres el asistente de un grupo que planea un viaje. Tienen un itinerario ya armado y una lista de ideas (videos de TikTok, reels) sobre comida, planes, compras y tips.

Tu tarea: para cada idea, decir dónde encaja mejor dentro del itinerario existente, sin cambiarlo. Elige UNA opción por idea (usa la etiqueta tal cual):
- "e…" una actividad concreta cuando la idea sirve para esa actividad (ej. un video de tiendas de los outlets → la visita a los outlets; un restaurante de Disney Springs → la cena en Disney Springs; un tip de un parque → la visita a ese parque).
- "s…" un hueco libre de un día en ese lugar, cuando la idea es un plan que cabe ahí.
- "D…" el día en general, si aplica al lugar de ese día pero no a una actividad ni a un hueco.
- "none" si no encaja en ningún día del viaje.

LUGARES lista cada zona del viaje con sus sitios (otros nombres entre paréntesis). El "lugar sugerido" de una idea es una clasificación automática y puede estar mal: decide con la nota, el post y lo que dice el video (extracto de una transcripción automática, puede tener errores). Usa el sentido común (Brickell está en Miami). Si una idea encaja en varias actividades, elige la más útil.
Reglas:
- El target debe ser exactamente la actividad o el hueco del que habla tu reason (si la razón menciona Royal Beach Club, el target es esa actividad).
- Respeta el momento del día: un plan de noche (bar, fiesta, rooftop) no va en un desayuno o almuerzo; una comida va en la comida más cercana en ese lugar o en un hueco.
- No inventes datos: menciona solo lo que dicen la idea o el itinerario.
En "reason" escribe en español, máximo 18 palabras, por qué encaja y qué deberían hacer o probar ahí (ej. "El sábado van a los outlets: el video recomienda la tienda de Nike").`;

const SCHEMA = {
  type: "object",
  properties: {
    links: {
      type: "array",
      items: {
        type: "object",
        properties: {
          ideaId: { type: "string" },
          target: { type: "string" },
          reason: { type: "string" },
        },
        required: ["ideaId", "target", "reason"],
        additionalProperties: false,
      },
    },
  },
  required: ["links"],
  additionalProperties: false,
};

export class IdeaPlanError extends Error {}

function cut(text: string | undefined, max: number) {
  if (!text) return "";
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

function describeIdea(i: Idea, label: string, keywords: Set<string>): string {
  const type = i.cat ?? i.suggestion?.cat;
  const place = i.place ?? i.suggestion?.place;
  const title = cut(i.title, 300);
  // Hashtags the caption already contains add nothing.
  const inTitle = normalizeText(title);
  const tags = (i.tags ?? []).filter((t) => !inTitle.includes(normalizeText(t))).slice(0, 8);
  const lines = [
    `${label} ${i.platform}${place ? ` · lugar sugerido: ${place}` : ""}${type && IDEA_TYPES[type] ? ` · tipo: ${IDEA_TYPES[type].label}` : ""}`,
    i.note && ` nota: ${cut(i.note, 200)}`,
    title && ` post: ${title}`,
    tags.length > 0 && ` tags: ${tags.join(", ")}`,
    i.transcript && ` video: ${transcriptExcerpt(i.transcript, keywords, i.note ? TRANSCRIPT_WITH_NOTE : TRANSCRIPT_CHARS)}`,
  ];
  return lines.filter(Boolean).join("\n");
}

// Each area with its spots, and up to 3 other names per spot.
function describePlaces(places: TripPlace[]): string {
  const areas = places.filter((p) => !isVenue(p));
  const home = (v: TripPlace) => [...v.parents].sort((a, b) => a.length - b.length)[0];
  return areas.map((a) => {
    const spots = places.filter((v) => isVenue(v) && home(v) === a.name)
      .map((v) => (v.aliases.length ? `${v.name} (${v.aliases.slice(0, 3).join(", ")})` : v.name));
    return spots.length ? `${a.name}: ${spots.join("; ")}` : a.name;
  }).join("\n");
}

type Target = Omit<IdeaLink, "ideaId" | "reason" | "source">;

// The prompt, plus the label → id maps to read the answer back. Pure, so it can
// be tested and measured without calling the API. `onlyIds` limits the ideas.
export function buildPlanPrompt(payload: RoomPayload, onlyIds?: string[]) {
  const days = payload.days ?? [];
  const places = tripPlaces(payload.trip?.destination, days, payload.ideaPlaces);
  const areas = places.filter((p) => !isVenue(p));
  const ideas = (payload.ideas ?? [])
    .filter((i) => i.status !== "discarded" && (i.note || i.title || i.transcript || i.place))
    .filter((i) => !onlyIds || onlyIds.includes(i.id))
    .slice(0, MAX_IDEAS);

  // Labeled options the model can pick from.
  const placeEvents = new Set(places.flatMap((p) => p.eventIds));
  const targets = new Map<string, Target>();
  let e = 0;
  let s = 0;
  const itinerary = days.map((day, n) => {
    const dayLabel = `D${n + 1}`;
    const dayAreas = areas.filter((p) => p.dayIds.includes(day.id)).map((p) => p.name);
    const lines = [`${dayLabel} ${day.label}${day.sub ? ` · ${day.sub}` : ""}${dayAreas.length ? ` · zonas: ${dayAreas.join(", ")}` : ""}`];
    targets.set(dayLabel, { dayId: day.id });
    for (const ev of [...day.events].sort((a, b) => a.start - b.start)) {
      // Flights, car rentals, check-outs: never where an idea goes (the cruise
      // check-in is, as a place of its own), and they are a third of the prompt.
      if (ev.cat === "logist" && !placeEvents.has(ev.id)) continue;
      const key = `e${++e}`;
      targets.set(key, { dayId: day.id, eventId: ev.id });
      lines.push(` ${key} ${fmtHour(ev.start)}${ev.end > ev.start ? `–${fmtHour(ev.end)}` : ""} ${ev.title}${ev.note ? ` — ${cut(ev.note, 90)}` : ""}`);
    }
    for (const slot of freeSlots(day)) {
      const key = `s${++s}`;
      targets.set(key, { dayId: day.id, slot });
      lines.push(` ${key} LIBRE ${fmtHour(slot.start)}–${fmtHour(slot.end)}`);
    }
    return lines.join("\n");
  }).join("\n");

  // Words that make a transcript passage worth sending: places and activities.
  const keywords = new Set(vocab([
    ...places.flatMap((p) => [p.name, ...p.aliases]),
    ...days.flatMap((d) => d.events.map((ev) => ev.title)),
  ].join(" ")));
  const ideaIds = new Map(ideas.map((i, n) => [`i${n + 1}`, i.id]));
  const ideaText = ideas.map((i, n) => describeIdea(i, `i${n + 1}`, keywords)).join("\n\n");

  const user = `LUGARES\n${describePlaces(places)}\n\nITINERARIO\n${itinerary}\n\nIDEAS\n${ideaText}\n\n` +
    `Devuelve un elemento en "links" por cada idea (ideaId = su etiqueta: i1, i2…).`;
  return { system: SYSTEM, user, ideaIds, targets, count: ideas.length };
}

export async function planIdeasWithClaude(
  payload: RoomPayload, onlyIds?: string[],
): Promise<{ links: IdeaLink[]; usage: { input: number; output: number } }> {
  if (!process.env.ANTHROPIC_API_KEY) throw new IdeaPlanError("Falta ANTHROPIC_API_KEY en el servidor.");
  const { system, user, ideaIds, targets, count } = buildPlanPrompt(payload, onlyIds);
  if (count === 0) return { links: [], usage: { input: 0, output: 0 } };

  const client = new Anthropic();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 200 + count * 80,   // a cap (~40 tokens per answer), not a cost
    system,
    messages: [{ role: "user", content: user }],
    output_config: { format: { type: "json_schema", schema: SCHEMA } },
  });

  if (response.stop_reason === "refusal") throw new IdeaPlanError("El modelo no pudo analizar estas ideas.");
  if (response.stop_reason === "max_tokens") throw new IdeaPlanError("Demasiadas ideas para analizar de una vez.");
  const text = response.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text;
  if (!text) throw new IdeaPlanError("Respuesta vacía del modelo.");

  const parsed = JSON.parse(text) as { links: { ideaId: string; target: string; reason: string }[] };
  const links: IdeaLink[] = [];
  for (const l of parsed.links ?? []) {
    const ideaId = ideaIds.get(l.ideaId?.trim());
    const target = targets.get(l.target?.trim());
    if (!ideaId || !target) continue;   // "none" or anything invented is dropped
    links.push({ ideaId, ...target, reason: cut(l.reason, 160), source: "claude" });
  }
  return { links, usage: { input: response.usage.input_tokens, output: response.usage.output_tokens } };
}
