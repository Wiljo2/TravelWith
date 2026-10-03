import Anthropic from "@anthropic-ai/sdk";
import { IDEA_TYPES } from "@/constants/ideaTypes";
import { fmtHour } from "@/utils/time";
import { freeSlots } from "@/utils/ideaPlan";
import { normalizeText, vocab } from "@/utils/ideas";
import { transcriptExcerpt } from "@/utils/excerpt";
import { CRUISE_PLACE, isVenue, tripPlaces, type TripPlace } from "@/utils/places";
import type { RoomPayload } from "@/hooks/useRoom";
import type { Day, Idea, IdeaLink, IdeaPlanResult } from "@/types";

// "Analizar con Claude": one call that reads the whole trip (places, each day's
// phase, every activity and free gap) and the ideas, and says for each idea its
// place, its type and when it helps — an activity, a free gap, a day, or before
// the trip. Both views (by place, by day) are built from this one answer.
//
// The model only picks among labeled options (P3, e12, s2, D4), so it can't
// invent ids or times, and every answer is validated against the plan. The
// trip overview goes in a cached system block: analyzing only the new ideas
// later reuses it. Transcripts are cut to the opening plus the passages that
// mention the trip (transcriptExcerpt).

const MODEL = process.env.IDEAS_MODEL ?? "claude-sonnet-5-5";
const MAX_IDEAS = 60;
const TRANSCRIPT_CHARS = 900;     // ~220 tokens per video
const TRANSCRIPT_WITH_NOTE = 500; // the member's note already says what it's about

const SYSTEM = `Eres el asistente de un grupo que planea un viaje. Tienen un itinerario armado y guardan ideas (TikToks, reels) sobre comida, planes, compras y tips. Para cada idea decides, sin cambiar el plan:

- place: el lugar del viaje del que trata la idea (etiqueta P…), o "none" si no trata de un lugar del viaje.
- cat: tip, comida, actividad, compras o noche.
- target: dónde les sirve. "e…" una actividad concreta a la que la idea aporta (qué hacer, comer o saber ahí); "s…" un hueco libre, si es un plan nuevo que cabe ahí; "D…" el día en general; "none" si no aplica a este viaje.
- before: true si hay que actuar ANTES del viaje (comprar algo, empacar, reservar, registrarse, decidir un paquete). El target es entonces el día o la actividad para la que se preparan.

Cómo decidir:
- Geografía: usa tu conocimiento del mundo. Barrios, parques, restaurantes y aeropuertos pertenecen a su ciudad (International Drive, Kissimmee y Lake Buena Vista están en Orlando; Brickell, Wynwood y Little Havana en Miami; MCO es el aeropuerto de Orlando, MIA el de Miami). Una idea solo va a días en los que el grupo está en ese lugar.
- Palabras genéricas (buffet, piscina, cena, playa, parque) no dicen el lugar: decide por los nombres propios y el contexto del video.
- Tiempo: respeta la fase de cada día (ITINERARIO). Lo del embarque va al día de embarque; lo del desembarque (maletas, salida del barco, self-assist) solo a la última noche a bordo o a la mañana de desembarque. Un plan de noche no va a un desayuno.
- Transporte: un tip de aeropuerto aplica solo al vuelo que usa ese aeropuerto en esa dirección (llegada o salida); si no lo usan así, "none". Un tip de carro rentado va a la recogida del carro o al trayecto que menciona (peajes, parqueo).
- Prefiere la actividad cuyo tema coincide con la idea sobre un hueco libre (un tip de parqueo en Universal → el traslado a Universal; comida de Disney Springs → la visita a Disney Springs).
- Tips generales de un crucero (comida incluida, bebidas, happy hour) van a la primera actividad a bordo donde sirven, o before=true si implican comprar o decidir algo antes de embarcar.
- Un video sobre un destino que no visitan: place "none" y target "none".
- No inventes datos: menciona solo lo que dicen la idea o el itinerario.

En "reason" escribe en español, máximo 18 palabras, por qué encaja y qué hacer o probar ahí (ej. "El sábado van a Universal: con el contrato de Avis el parqueo prime es gratis"). Nombra los días por su fecha o día de la semana, nunca por etiqueta (D3, e12). Si no aplica, di por qué.`;

const SCHEMA = {
  type: "object",
  properties: {
    ideas: {
      type: "array",
      items: {
        type: "object",
        properties: {
          idea: { type: "string" },
          reason: { type: "string" },
          place: { type: "string" },
          cat: { type: "string", enum: [...Object.keys(IDEA_TYPES), "none"] },
          before: { type: "boolean" },
          target: { type: "string" },
        },
        required: ["idea", "reason", "place", "cat", "before", "target"],
        additionalProperties: false,
      },
    },
  },
  required: ["ideas"],
  additionalProperties: false,
};

export class IdeaPlanError extends Error {}

function cut(text: string | undefined, max: number) {
  if (!text) return "";
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

function describeIdea(i: Idea, label: string, keywords: Set<string>): string {
  const title = cut(i.title, 300);
  // Hashtags the caption already contains add nothing.
  const inTitle = normalizeText(title);
  const tags = (i.tags ?? []).filter((t) => !inTitle.includes(normalizeText(t))).slice(0, 8);
  const lines = [
    `${label} ${i.platform}`,
    i.note && ` nota del grupo: ${cut(i.note, 200)}`,
    title && ` post: ${title}`,
    tags.length > 0 && ` tags: ${tags.join(", ")}`,
    i.transcript && ` video: ${transcriptExcerpt(i.transcript, keywords, i.note ? TRANSCRIPT_WITH_NOTE : TRANSCRIPT_CHARS)}`,
  ];
  return lines.filter(Boolean).join("\n");
}

// Where each day sits in the trip, beyond its subtitle: "día 5 de 9", and for a
// cruise, "crucero día 5 de 5 · desembarque" — what puts a disembarkation tip on
// the last morning and not on a sea day.
export function dayPhases(days: Day[], places: TripPlace[]): string[] {
  const onCruise = (d: Day) => places.some((p) => p.name === CRUISE_PLACE && p.dayIds.includes(d.id));
  const first = days.findIndex((d) => /\bembarque\b/i.test(d.sub ?? "") || onCruise(d));
  const disembark = days.findLastIndex((d) => /desembarque/i.test(d.sub ?? ""));
  const last = disembark >= first ? disembark : days.findLastIndex(onCruise);
  return days.map((_, n) => {
    const parts = [`día ${n + 1} de ${days.length}`];
    if (first >= 0 && last > first && n >= first && n <= last) {
      const k = n - first + 1;
      const total = last - first + 1;
      parts.push(`crucero día ${k} de ${total}`);
      if (k === 1) parts.push("embarque");
      if (k === total - 1) parts.push("última noche a bordo");
      if (k === total) parts.push("desembarque por la mañana");
    }
    return parts.join(" · ");
  });
}

type Target = Omit<IdeaLink, "ideaId" | "reason" | "source" | "before">;

// The prompt, plus the label → id maps to read the answer back. Pure, so it can
// be tested and measured without calling the API. `onlyIds` limits the ideas.
export function buildPlanPrompt(payload: RoomPayload, onlyIds?: string[]) {
  const days = payload.days ?? [];
  const places = tripPlaces(payload.trip?.destination, days, payload.ideaPlaces);
  const areas = places.filter((p) => !isVenue(p));
  const ideas = (payload.ideas ?? [])
    .filter((i) => i.status !== "discarded" && (i.note || i.title || i.transcript))
    .filter((i) => !onlyIds || onlyIds.includes(i.id))
    .slice(0, MAX_IDEAS);

  const dayLabel = new Map(days.map((d, n) => [d.id, `D${n + 1}`]));
  const placeLabels = new Map(places.map((p, n) => [`P${n + 1}`, p.name]));
  const home = (v: TripPlace) => [...v.parents].sort((a, b) => a.length - b.length)[0];
  const placeText = places.map((p, n) => {
    const where = isVenue(p) && home(p) ? ` (en ${home(p)})` : "";
    const aka = p.aliases.length ? ` · también: ${p.aliases.slice(0, 4).join(", ")}` : "";
    return `P${n + 1} ${p.name}${where}${aka} · días ${p.dayIds.map((id) => dayLabel.get(id)).filter(Boolean).join(", ")}`;
  }).join("\n");

  const phases = dayPhases(days, places);
  const targets = new Map<string, Target>();
  let e = 0;
  let s = 0;
  const itinerary = days.map((day, n) => {
    const label = `D${n + 1}`;
    const dayAreas = areas.filter((p) => p.dayIds.includes(day.id)).map((p) => p.name);
    const head = [`${label} ${day.label}`, day.sub, phases[n], dayAreas.length && `zonas: ${dayAreas.join(", ")}`];
    const lines = [head.filter(Boolean).join(" · ")];
    targets.set(label, { dayId: day.id });
    for (const ev of [...day.events].sort((a, b) => a.start - b.start)) {
      const key = `e${++e}`;
      targets.set(key, { dayId: day.id, eventId: ev.id });
      lines.push(` ${key} ${fmtHour(ev.start)}${ev.end > ev.start ? `–${fmtHour(ev.end)}` : ""} ${ev.title}${ev.note ? ` — ${cut(ev.note.replace(/https?:\/\/\S+/g, ""), 90)}` : ""}`);
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

  const trip = `LUGARES DEL VIAJE\n${placeText}\n\nITINERARIO\n${itinerary}`;
  const user = `IDEAS\n${ideaText}\n\nDevuelve un elemento en "ideas" por cada idea (idea = su etiqueta: i1, i2…).`;
  return { system: SYSTEM, trip, user, ideaIds, placeLabels, targets, count: ideas.length };
}

type Answer = { idea: string; reason: string; place: string; cat: string; before: boolean; target: string };

// Reads the model's answer back into links (where each idea helps) and classes
// (its place and type). Labels that don't exist — "none" or invented — are dropped.
export function readAnswer(answers: Answer[], prompt: ReturnType<typeof buildPlanPrompt>) {
  const links: IdeaLink[] = [];
  const classes: IdeaPlanResult["classes"] = [];
  for (const a of answers) {
    const ideaId = prompt.ideaIds.get(a.idea?.trim());
    if (!ideaId) continue;
    // The label, or (sometimes) the place's name itself.
    const place = prompt.placeLabels.get(a.place?.trim())
      ?? [...prompt.placeLabels.values()].find((n) => normalizeText(n) === normalizeText(a.place?.trim() ?? ""));
    const cat = IDEA_TYPES[a.cat] ? a.cat : undefined;
    if (place || cat) classes.push({ ideaId, place, cat });
    const target = prompt.targets.get(a.target?.trim());
    if (target) links.push({ ideaId, ...target, ...(a.before ? { before: true } : {}), reason: cut(a.reason, 160), source: "claude" });
  }
  return { links, classes };
}

export async function planIdeasWithClaude(
  payload: RoomPayload, onlyIds?: string[], model = MODEL,
): Promise<Omit<IdeaPlanResult, "at"> & { usage: { input: number; cached: number; output: number } }> {
  if (!process.env.ANTHROPIC_API_KEY) throw new IdeaPlanError("Falta ANTHROPIC_API_KEY en el servidor.");
  const prompt = buildPlanPrompt(payload, onlyIds);
  // The ideas actually sent: the client marks exactly these as analyzed.
  const sent = [...prompt.ideaIds.values()];
  if (prompt.count === 0) return { links: [], classes: [], ideaIds: sent, usage: { input: 0, cached: 0, output: 0 } };

  const client = new Anthropic();
  const response = await client.messages.create({
    model,
    max_tokens: 1000 + prompt.count * 200,
    system: [
      { type: "text", text: prompt.system },
      { type: "text", text: prompt.trip, cache_control: { type: "ephemeral" } },
    ],
    messages: [{ role: "user", content: prompt.user }],
    // Haiku has no effort setting.
    output_config: { ...(model.includes("haiku") ? {} : { effort: "low" as const }), format: { type: "json_schema", schema: SCHEMA } },
  });

  if (response.stop_reason === "refusal") throw new IdeaPlanError("El modelo no pudo analizar estas ideas.");
  if (response.stop_reason === "max_tokens") throw new IdeaPlanError("Demasiadas ideas para analizar de una vez.");
  const text = response.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text;
  if (!text) throw new IdeaPlanError("Respuesta vacía del modelo.");

  const parsed = JSON.parse(text) as { ideas?: Answer[] };
  const { links, classes } = readAnswer(parsed.ideas ?? [], prompt);
  const u = response.usage;
  return {
    links, classes, ideaIds: sent,
    usage: { input: u.input_tokens + (u.cache_creation_input_tokens ?? 0), cached: u.cache_read_input_tokens ?? 0, output: u.output_tokens },
  };
}
