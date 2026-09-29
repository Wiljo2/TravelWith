import type { Day, IdeaPlatform } from "@/types";
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

export function detectPlatform(url: string): IdeaPlatform {
  let host = "";
  try { host = new URL(url).host.replace(/^www\./, ""); } catch { return "other"; }
  if (host.endsWith("tiktok.com")) return "tiktok";
  if (host.endsWith("instagram.com")) return "instagram";
  if (host.endsWith("youtube.com") || host === "youtu.be") return "youtube";
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
const CRUISE_ALIASES = ["crucero", "cruise", "barco", "ship", "a bordo", "onboard", "royal caribbean", "cabina", "cubierta", "deck"];
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

// Texts that describe each place: its name plus the itinerary activities held
// there. A day's activity goes to the places it names ("Check-in hotel Miami
// (Brickell)" → Miami), or to all of the day's places when it names none.
// This is what tells the classifiers that Hogsmeade is at Universal.
export function placeProfiles(places: string[], days: Day[]): PlaceProfiles {
  const profiles: PlaceProfiles = Object.fromEntries(places.map((p) => [p, [p]]));
  const byKey = new Map(places.map((p) => [normalizeText(p), p]));
  for (const day of days) {
    const dayPlaces = seedPlaces(undefined, [day]).map((p) => byKey.get(normalizeText(p))).filter((p): p is string => !!p);
    for (const e of day.events) {
      const text = `${e.title} ${e.note}`.trim();
      const named = dayPlaces.filter((p) => nameMatches(text, p));
      for (const p of named.length ? named : dayPlaces) profiles[p].push(text);
    }
  }
  return profiles;
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

function vocab(text: string): string[] {
  return normalizeText(text).split(/[^a-z0-9ñ]+/).filter((t) => t.length >= 4 && !STOPWORDS.has(t));
}

// Fallback when no place is named: words that only appear in one place's
// activities point to it (1 / number of places using the word).
function placeByVocabulary(text: string, profiles: PlaceProfiles): string | undefined {
  const words = new Set(vocab(text));
  if (words.size === 0) return undefined;
  const sets = Object.entries(profiles).map(([p, texts]) => [p, new Set(vocab(texts.join(" ")))] as const);
  const df = new Map<string, number>();
  for (const [, s] of sets) for (const w of s) df.set(w, (df.get(w) ?? 0) + 1);
  const ranked = sets
    .map(([p, s]) => ({ p, score: [...words].reduce((sum, w) => sum + (s.has(w) ? 1 / df.get(w)! : 0), 0) }))
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

// Picks the place whose name best matches the text. Multi-word places need the
// larger share of their words ("Universal Studios Orlando" beats "Orlando" when
// the text says "Universal Orlando").
export function suggestPlace(text: string, places: string[], tags: string[] = []): string | undefined {
  const t = asWords(`${text} ${tags.join(" ")}`);
  let best: { place: string; ratio: number; hits: number } | undefined;
  for (const place of places) {
    const words = place === CRUISE_PLACE
      ? CRUISE_ALIASES.filter((a) => t.includes(asWords(a))).map(() => "x")
      : normalizeText(place).split(/[^a-z0-9ñ]+/).filter((w) => w.length >= 3);
    const total = place === CRUISE_PLACE ? 1 : words.length;
    const hits = place === CRUISE_PLACE
      ? Math.min(1, words.length)
      : words.filter((w) => t.includes(` ${w} `) || inTags(w, tags)).length;
    if (hits === 0 || total === 0) continue;
    const ratio = hits / total;
    if (ratio < 0.5) continue;
    // More matched words = more specific; ties go to the earlier (day-derived) place.
    if (!best || hits > best.hits || (hits === best.hits && ratio > best.ratio)) best = { place, ratio, hits };
  }
  return best?.place;
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
export function classifyIdea(text: string, profiles: PlaceProfiles, tags: string[] = []) {
  const places = Object.keys(profiles);
  return {
    place: suggestPlace(text, places, tags) ?? placeByVocabulary(`${text} ${tags.join(" ")}`, profiles),
    cat: suggestType(`${text} ${tags.join(" ")}`),
  };
}

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
export function classifyIdeaFields(fields: IdeaTextFields, profiles: PlaceProfiles) {
  const tiers = [
    { text: fields.note ?? "", tags: [] as string[] },
    { text: fields.title ?? "", tags: fields.tags ?? [] },
    { text: fields.transcript ?? "", tags: [] as string[] },
  ].filter((t) => t.text.trim() || t.tags.length);
  let place: string | undefined;
  let cat: string | undefined;
  for (const tier of tiers) {
    const r = classifyIdea(tier.text, profiles, tier.tags);
    place ??= r.place;
    cat ??= r.cat;
    if (place && cat) break;
  }
  return { place, cat };
}
