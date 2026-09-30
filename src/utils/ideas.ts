import type { Day, IdeaPlatform } from "@/types";
import type { TripPlace } from "@/utils/places";
import { IDEA_TYPES, IDEA_TYPE_PRIORITY } from "@/constants/ideaTypes";
import { extractUrls } from "@/utils/linkify";

// Every link in a pasted text (a WhatsApp message, several links…). Social links
// pasted without scheme ("tiktok.com/…") still count.
export function findIdeaUrls(text: string): string[] {
  const withScheme = text.replace(
    /(^|\s)((?:www\.|vm\.|vt\.)?(?:tiktok|instagram|youtube)\.com\/\S+|youtu\.be\/\S+)/gi,
    "$1https://$2",
  );
  return extractUrls(withScheme);
}

// `domain` itself or a subdomain of it — never a lookalike ("eviltiktok.com").
export function isHostOf(host: string, domain: string): boolean {
  const h = host.toLowerCase();
  return h === domain || h.endsWith(`.${domain}`);
}

export function detectPlatform(url: string): IdeaPlatform {
  let host = "";
  try { host = new URL(url).hostname; } catch { return "other"; }
  if (isHostOf(host, "tiktok.com")) return "tiktok";
  if (isHostOf(host, "instagram.com")) return "instagram";
  if (isHostOf(host, "youtube.com") || host === "youtu.be") return "youtube";
  return "other";
}

// Canonical form for de-duplication: no tracking query, no trailing slash.
export function canonicalUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.host.replace(/^www\./, "")}${u.pathname.replace(/\/$/, "")}`.toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
}

export function normalizeText(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// " word word " form, so phrases can be matched on whole-word boundaries.
const asWords = (s: string) => ` ${normalizeText(s).replace(/[^a-z0-9ñ]+/g, " ").trim()} `;

// ── Places ────────────────────────────────────────────────────────────────────

export const CRUISE_PLACE = "Crucero";
const CRUISE_RE = /crucero|cruise|barco|a bordo|en el mar|navegaci/i;
const CRUISE_ALIASES = ["crucero", "cruise", "barco", "ship", "a bordo", "onboard", "royal caribbean", "cabina", "cubierta", "deck", "of the seas"];
// Itinerary wording that describes a moment of the trip, not a place.
const LEADING_GENERIC = /^(vuelo|llegada a|llegada|traslado a|traslado|embarque|desembarque|regreso a|regreso|salida de|salida a|salida|tiempo libre en|perfect day at|visita a|dia libre en|dia en)\s+/;
const GENERIC_ONLY = /^(dia( \d+| libre)?|libre|vuelo|llegada|traslado|embarque|desembarque|regreso|salida)$/;

// Places the group talks about, derived from the trip: the destination plus the
// places named in each day's subtitle ("Nassau, Bahamas · Día 3" → Nassau, Bahamas).
// Day places come first: they're more specific and win ties.
export function seedPlaces(destination: string | undefined, days: Day[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (raw: string) => {
    let place = raw.replace(/[^\p{L}\p{N}\s'.&-]/gu, " ").replace(/\s+/g, " ").trim();
    if (CRUISE_RE.test(place)) place = CRUISE_PLACE;
    let key = normalizeText(place);
    for (let prev = ""; prev !== key; ) {
      prev = key;
      const m = key.match(LEADING_GENERIC);
      if (m) { place = place.slice(m[0].length); key = key.slice(m[0].length); }
    }
    place = place.trim();
    key = normalizeText(place);
    if (place.length < 3 || GENERIC_ONLY.test(key) || seen.has(key)) return;
    seen.add(key);
    out.push(place);
  };
  for (const d of days) for (const part of (d.sub ?? "").split(/[·→,&/|]| - /)) push(part);
  for (const part of (destination ?? "").split(/[·,&/|]| y /)) push(part);
  return out.slice(0, 12);
}

export type PlaceProfiles = Record<string, string[]>;

// What the classifiers know about the trip's places: names, aliases and the
// itinerary text of each one.
export interface PlaceIndex {
  places: TripPlace[];
  profiles: PlaceProfiles;
}

// Texts that describe each place: its names plus the itinerary activities held
// there. An area gets its days' activities (only those naming it when they name
// one: "Check-in hotel Miami (Brickell)" → Miami); a venue gets its own.
// This is what tells the classifiers that Hogsmeade is at Universal.
export function placeProfiles(places: TripPlace[], days: Day[]): PlaceProfiles {
  const profiles: PlaceProfiles = Object.fromEntries(places.map((p) => [p.name, [p.name, ...p.aliases]]));
  const areas = places.filter((p) => p.eventIds.length === 0);
  for (const day of days) {
    const dayAreas = areas.filter((a) => a.dayIds.includes(day.id));
    for (const e of day.events) {
      const text = `${e.title} ${e.note}`.trim();
      const named = dayAreas.filter((a) => nameMatches(text, a.name));
      for (const a of named.length ? named : dayAreas) profiles[a.name].push(text);
    }
  }
  const events = new Map(days.flatMap((d) => d.events.map((e) => [e.id, `${e.title} ${e.note}`.trim()] as const)));
  for (const v of places) for (const id of v.eventIds) if (events.has(id)) profiles[v.name].push(events.get(id)!);
  return profiles;
}

export function placeIndex(places: TripPlace[], days: Day[]): PlaceIndex {
  return { places, profiles: placeProfiles(places, days) };
}

function nameMatches(text: string, place: string): boolean {
  const t = asWords(text);
  if (place === CRUISE_PLACE) return CRUISE_ALIASES.some((a) => t.includes(asWords(a)));
  return t.includes(asWords(place));
}

const STOPWORDS = new Set(normalizeText(
  "para with from that this your the and los las del por con una uno unos unas que como donde todo toda " +
  "tips best top mejor mejores aqui here there have tiene tienes hacer visit visitar dia dias day days " +
  "desde hasta antes despues luego manana noche tarde nuevo nueva gran more most very muy hotel cena almuerzo " +
  "desayuno comida regreso check reservar opcional temprano",
).split(" "));

// Distinctive words of a text (accent-free, 4+ letters, no stopwords).
export function vocab(text: string): string[] {
  return normalizeText(text).split(/[^a-z0-9ñ]+/).filter((t) => t.length >= 4 && !STOPWORDS.has(t));
}

// Fallback when no place is named: words that only appear in one place's
// activities point to it (1 / number of places using the word). A venue's words
// are also in its area's profile; the venue, being more specific, keeps them.
function placeByVocabulary(text: string, index: PlaceIndex): string | undefined {
  const words = new Set(vocab(text));
  if (words.size === 0) return undefined;
  const sets = new Map(Object.entries(index.profiles).map(([p, texts]) => [p, new Set(vocab(texts.join(" ")))]));
  const parentsOf = new Map(index.places.map((p) => [p.name, p.parents]));
  const credit = new Map<string, string[]>();   // word → places it points to
  for (const w of words) {
    const users = [...sets].filter(([, s]) => s.has(w)).map(([p]) => p);
    const covered = new Set(users.flatMap((u) => parentsOf.get(u) ?? []));
    credit.set(w, users.filter((u) => !covered.has(u)));
  }
  const ranked = [...sets.keys()]
    .map((p) => ({ p, score: [...credit.values()].reduce((sum, us) => sum + (us.includes(p) ? 1 / us.length : 0), 0) }))
    .sort((a, b) => b.score - a.score);
  const [first, second] = ranked;
  if (!first || first.score < 0.99 || (second && first.score - second.score < 0.5)) return undefined;
  return first.p;
}

// Hashtags glue words together (#universalorlandoresort): a place word also
// counts when it appears inside one of them.
function inTags(word: string, tags: string[]): boolean {
  return word.length >= 4 && tags.some((t) => normalizeText(t).replace(/[^a-z0-9ñ]/g, "").includes(word));
}

const NAME_CONNECTORS = new Set(["the", "and", "del", "las", "los"]);
const nameWords = (name: string) =>
  normalizeText(name).split(/[^a-z0-9ñ]+/).filter((w) => w.length >= 3 && !NAME_CONNECTORS.has(w));
const asPlace = (p: string | TripPlace): TripPlace =>
  typeof p === "string" ? { name: p, aliases: [], dayIds: [], eventIds: [], parents: [] } : p;

// Picks the place the text names. Each name (or alias) needs at least two of its
// words, or half of them, and rare words weigh more ("Orlando" is in several
// names; "Outlets" only in one). A venue beats its area ("Premium Outlets en
// Orlando" → the outlets), unless the text names several spots of that area
// (a video about all of Universal's parks stays at Universal).
export function suggestPlace(text: string, places: (string | TripPlace)[], tags: string[] = []): string | undefined {
  const list = places.map(asPlace);
  return pickPlace(placeScores(text, list, tags), list);
}

// How strongly a text names each place (only places it names).
function placeScores(text: string, list: TripPlace[], tags: string[] = []): Map<string, number> {
  const t = asWords(`${text} ${tags.join(" ")}`);
  const namesOf = (p: TripPlace) =>
    [...p.name.split(" / "), ...p.aliases].map(nameWords).filter((ws) => ws.length > 0);
  const df = new Map<string, number>();
  for (const p of list) for (const w of new Set(namesOf(p).flat())) df.set(w, (df.get(w) ?? 0) + 1);
  const found = (w: string) => t.includes(` ${w} `) || inTags(w, tags);

  const scores = new Map<string, number>();
  for (const p of list) {
    if (p.name === CRUISE_PLACE) {
      if (CRUISE_ALIASES.some((a) => t.includes(asWords(a)))) scores.set(p.name, 1);
      continue;
    }
    let score = 0;
    for (const words of namesOf(p)) {
      const hits = words.filter(found);
      if (hits.length < Math.min(2, words.length) || hits.length / words.length < 0.5) continue;
      score = Math.max(score, hits.reduce((sum, w) => sum + 1 / df.get(w)!, 0));
    }
    if (score > 0) scores.set(p.name, score);
  }
  return scores;
}

const TIE = 1e-6;   // scores are sums of fractions: equal ones may differ in the last digit

// The best place among the scored ones. An area with one named spot yields to
// it; with several, the area is the answer.
function pickPlace(scores: Map<string, number>, list: TripPlace[]): string | undefined {
  const matched = list.filter((p) => scores.has(p.name));
  const children = new Map<string, number>();
  for (const p of matched) for (const parent of p.parents) children.set(parent, (children.get(parent) ?? 0) + 1);
  const broad = list.filter((p) => (children.get(p.name) ?? 0) >= 2);
  if (broad.length) return broad[0].name;
  const ranked = matched
    .filter((p) => children.get(p.name) !== 1)
    // Ties go to the venue, then to the earlier place (trip order).
    .sort((a, b) => {
      const d = scores.get(b.name)! - scores.get(a.name)!;
      return Math.abs(d) > TIE ? d : Number(b.parents.length > 0) - Number(a.parents.length > 0);
    });
  return ranked[0]?.name;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export function suggestType(text: string): string | undefined {
  const t = asWords(text);
  let best: string | undefined;
  let bestScore = 0;
  for (const key of IDEA_TYPE_PRIORITY) {
    const score = IDEA_TYPES[key].keywords.filter((k) => t.includes(asWords(k))).length;
    if (score > bestScore) { best = key; bestScore = score; }
  }
  return best;
}

// Named place first; otherwise the itinerary vocabulary of each place.
export function classifyIdea(text: string, index: PlaceIndex, tags: string[] = []) {
  return {
    place: suggestPlace(text, index.places, tags) ?? placeByVocabulary(`${text} ${tags.join(" ")}`, index),
    cat: suggestType(`${text} ${tags.join(" ")}`),
  };
}

// Bump when the rules change, so saved ideas get classified again.
export const CLASSIFIER_VERSION = 2;

export interface IdeaTextFields {
  note?: string;
  title?: string;
  tags?: string[];
  transcript?: string;
}

// Classifies from the most intentional source to the noisiest: the member's note,
// then the caption + hashtags, then what the video says. Each field (place, type)
// takes the first source that answers, so a passing word in the audio can't
// override an explicit caption.
export function classifyIdeaFields(fields: IdeaTextFields, index: PlaceIndex) {
  // The member's note states the intent: it wins alone.
  const note = fields.note?.trim();
  const fromNote = note ? classifyIdea(note, index) : { place: undefined, cat: undefined };

  // Otherwise every source adds evidence. TikTok's extra keywords are search
  // suggestions ("universal studios orlando" on an outlets video), so they weigh
  // less than what the creator wrote or said.
  let place = fromNote.place;
  if (!place) {
    const caption = fields.title ?? "";
    const hashtags = caption.match(/#[\p{L}\p{N}_]+/gu)?.map((h) => h.slice(1)) ?? [];
    const sources = [
      { weight: 1, scores: placeScores(caption, index.places, hashtags) },
      { weight: 0.5, scores: placeScores("", index.places, fields.tags ?? []) },
      { weight: 1, scores: placeScores(fields.transcript ?? "", index.places) },
    ];
    const total = new Map<string, number>();
    for (const { weight, scores } of sources) for (const [p, sc] of scores) total.set(p, (total.get(p) ?? 0) + weight * sc);
    place = pickPlace(total, index.places);
  }
  if (!place) {
    for (const text of [fields.title, fields.transcript]) {
      place = text ? classifyIdea(text, index, text === fields.title ? fields.tags : []).place : undefined;
      if (place) break;
    }
  }

  // The type: first source that answers, from the most intentional.
  const cat = fromNote.cat
    ?? suggestType(`${fields.title ?? ""} ${(fields.tags ?? []).join(" ")}`)
    ?? suggestType(fields.transcript ?? "");
  return { place, cat };
}
