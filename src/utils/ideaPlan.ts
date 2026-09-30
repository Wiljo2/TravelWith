import { HOUR_START } from "@/constants/time";
import { normalizeText, vocab } from "@/utils/ideas";
import { findPlace, isVenue, type TripPlace } from "@/utils/places";
import type { CalendarEvent, Day, Idea, IdeaLink } from "@/types";

// Matching ideas to the existing plan (read-only). Free and instant: shared
// distinctive words between an idea and an activity, the idea's type, and the
// places of each day. Claude refines this on demand (server/ideaPlan.ts).

const DAY_FROM = 9;          // free gaps are looked for between 9 am…
const DAY_TO = 22;           // …and 10 pm
const MIN_GAP = 1.5;         // hours
const EVENT_MIN_SCORE = 0.5;     // e.g. one word unique to an activity, heard in the video
const EVENT_TIE = 0.15;      // events this close to the best one also get the idea (max 2)

export type Slot = { start: number; end: number };

// Free gaps of at least MIN_GAP hours in the day's usual hours.
export function freeSlots(day: Day): Slot[] {
  const busy = [...day.events]
    .filter((e) => e.end > e.start)
    .sort((a, b) => a.start - b.start);
  const slots: Slot[] = [];
  let cursor = Math.max(DAY_FROM, HOUR_START);
  for (const e of busy) {
    if (e.start - cursor >= MIN_GAP) slots.push({ start: cursor, end: Math.min(e.start, DAY_TO) });
    cursor = Math.max(cursor, e.end);
  }
  if (DAY_TO - cursor >= MIN_GAP) slots.push({ start: cursor, end: DAY_TO });
  return slots.filter((s) => s.end - s.start >= MIN_GAP);
}

// Which calendar categories fit each idea type (activity blocks it can enrich).
const TYPE_TO_EVENT_CATS: Record<string, string[]> = {
  comida: ["comida"],
  noche: ["noche"],
  actividad: ["miami", "puerto", "barco"],
  compras: ["miami"],
};

// A short excerpt around the first matched word: the "why" of a free match.
export function snippet(text: string, word: string, radius = 8): string | undefined {
  const words = text.split(/\s+/);
  const idx = words.findIndex((w) => normalizeText(w).includes(word));
  if (idx < 0) return undefined;
  const from = Math.max(0, idx - radius);
  const to = Math.min(words.length, idx + radius + 1);
  return `${from > 0 ? "…" : ""}${words.slice(from, to).join(" ")}${to < words.length ? "…" : ""}`;
}

interface Candidate { day: Day; ev: CalendarEvent; score: number; word?: string }

// Words that name an area ("Nassau", "crucero") only say where, not which
// activity: the area already filters the days, so they don't count as evidence.
// Venue names ("Disney Springs") do point to activities.
function areaWords(places: TripPlace[]): Set<string> {
  return new Set([...places.filter((p) => !isVenue(p)).flatMap((p) => vocab(p.name)), ...vocab("crucero cruise barco ship")]);
}

export function matchIdeasToPlan(ideas: Idea[], days: Day[], places: TripPlace[]): IdeaLink[] {
  const ignore = areaWords(places);
  const events = days.flatMap((day) => day.events.map((ev) => ({
    day, ev, words: new Set(vocab(`${ev.title} ${ev.note}`).filter((w) => !ignore.has(w))),
  })));
  // How many activities use each word — among the days that could host the idea
  // ("piscina" is common in the trip, but unique within the cruise days).
  const docFreq = (pool: typeof events) => {
    const df = new Map<string, number>();
    for (const e of pool) for (const w of e.words) df.set(w, (df.get(w) ?? 0) + 1);
    return df;
  };
  const globalDf = docFreq(events);

  const links: IdeaLink[] = [];
  for (const idea of ideas) {
    if (idea.status === "discarded") continue;
    const place = findPlace(places, idea.place ?? idea.suggestion?.place);
    const type = idea.cat ?? idea.suggestion?.cat;
    // The member's note and the caption weigh more than a word said in passing.
    const sources = [
      { text: idea.note ?? "", weight: 1 },
      { text: [idea.title, ...(idea.tags ?? [])].join(" "), weight: 1 },
      { text: idea.transcript ?? "", weight: 0.5 },
    ];
    const weights = new Map<string, number>();
    for (const s of sources) for (const w of vocab(s.text)) weights.set(w, Math.max(weights.get(w) ?? 0, s.weight));

    // A known venue limits the options to its activities; an area, to its days.
    const pool = !place ? events
      : isVenue(place) ? events.filter(({ ev }) => place.eventIds.includes(ev.id))
      : events.filter(({ day }) => place.dayIds.includes(day.id));
    const df = place ? docFreq(pool) : globalDf;

    const candidates: Candidate[] = [];
    for (const { day, ev, words } of pool) {
      let score = 0;
      let best: { word: string; w: number } | undefined;
      for (const w of words) {
        const wt = weights.get(w);
        if (!wt) continue;
        const contrib = wt / (df.get(w) ?? 1);
        score += contrib;
        if (!best || contrib > best.w) best = { word: w, w: contrib };
      }
      if (score === 0) continue;
      if (type && TYPE_TO_EVENT_CATS[type]?.includes(ev.cat)) score += 0.3;
      candidates.push({ day, ev, score, word: best?.word });
    }
    candidates.sort((a, b) => b.score - a.score);

    const top = candidates[0];
    if (top && top.score >= EVENT_MIN_SCORE) {
      for (const c of candidates.filter((c) => top.score - c.score <= EVENT_TIE).slice(0, 2)) {
        // Quote the creator (note, caption, video), never TikTok's keyword list.
        const why = c.word && [idea.note, idea.title, idea.transcript].map((t) => t && snippet(t, c.word!)).find(Boolean);
        links.push({ ideaId: idea.id, dayId: c.day.id, eventId: c.ev.id, reason: why, source: "rules" });
      }
      continue;
    }

    // A venue's activities are the answer even without shared words: prefer the
    // ones of the idea's kind (a food video → the meals at Disney Springs).
    if (place && isVenue(place) && pool.length) {
      const ofType = pool.filter(({ ev }) => type && TYPE_TO_EVENT_CATS[type]?.includes(ev.cat));
      for (const { day, ev } of (ofType.length ? ofType : pool).slice(0, 2)) {
        links.push({ ideaId: idea.id, dayId: day.id, eventId: ev.id, source: "rules" });
      }
      continue;
    }

    // A park-like area has an activity that is the visit itself: tips go there.
    if (place?.anchors?.length) {
      for (const { day, ev } of events.filter(({ ev }) => place.anchors!.includes(ev.id)).slice(0, 2)) {
        links.push({ ideaId: idea.id, dayId: day.id, eventId: ev.id, source: "rules" });
      }
      continue;
    }

    // No activity fits: suggest the largest free gap on a day at that place.
    if (!place) continue;
    const options = days
      .filter((d) => place.dayIds.includes(d.id))
      .map((d) => ({ d, slot: freeSlots(d).sort((a, b) => (b.end - b.start) - (a.end - a.start))[0] }));
    if (options.length === 0) continue;
    const withSlot = options.filter((o) => o.slot).sort((a, b) => (b.slot!.end - b.slot!.start) - (a.slot!.end - a.slot!.start));
    const pick = withSlot[0] ?? options[0];
    links.push({ ideaId: idea.id, dayId: pick.d.id, slot: pick.slot, source: "rules" });
  }
  return links;
}
