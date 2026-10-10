import { CATS, INSIGHT_MAX, KINDS, MAX_INSIGHTS, MAX_SPOTS, ON_SCREEN_MAX, PHASES, SUMMARY_MAX, WHEN_MAX } from "@/server/video/analysisPrompt";
import { classifyIdeaFields, normalizeText, type PlaceIndex } from "@/utils/ideas";
import type { Idea, IdeaInsight, IdeaSpot, IdeaVideo, InsightKind, InsightPhase } from "@/types";

// What Gemini returns for a video, validated, and how it lands on the ideas:
// the video idea keeps the summary, the spots and the insights. A spot becomes
// an idea of its own only when the group saves it (spotIdea, utils/ideaVideo).

export { MAX_SPOTS, MAX_INSIGHTS };
const NAME_MAX = 80;
const CITY_MAX = 60;
const PRICE_MAX = 40;
const TIP_MAX = 200;
const PLACE_MAX = 60;

export interface VideoAnalysis {
  relevant: boolean;
  summary: string;
  onScreen?: string;
  spots: IdeaSpot[];
  insights?: IdeaInsight[];
}

const text = (v: unknown, max: number): string | undefined => {
  if (typeof v !== "string") return undefined;
  const t = v.replace(/\s+/g, " ").trim();
  if (!t) return undefined;
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
};

const second = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.round(v) : undefined);
const hour = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 24 ? Math.round(v * 4) / 4 : undefined);

function parseSpot(v: unknown): IdeaSpot | null {
  if (typeof v !== "object" || v === null) return null;
  const s = v as Record<string, unknown>;
  const name = text(s.name, NAME_MAX);
  if (!name) return null;
  const cat = typeof s.cat === "string" && CATS.includes(s.cat) ? s.cat : undefined;
  return {
    name,
    city: text(s.city, CITY_MAX),
    cat,
    at: second(s.at),
    price: text(s.price, PRICE_MAX),
    tip: text(s.tip, TIP_MAX),
  };
}

// An hour range only when it makes sense; a lone start is kept.
function parseInsight(v: unknown): IdeaInsight | null {
  if (typeof v !== "object" || v === null) return null;
  const s = v as Record<string, unknown>;
  const body = text(s.text, INSIGHT_MAX);
  if (!body || typeof s.kind !== "string" || !KINDS.includes(s.kind)) return null;
  const start = hour(s.start);
  const end = start !== undefined ? hour(s.end) : undefined;
  return {
    kind: s.kind as InsightKind,
    text: body,
    phase: typeof s.phase === "string" && PHASES.includes(s.phase) ? (s.phase as InsightPhase) : undefined,
    when: text(s.when, WHEN_MAX),
    start,
    end: end !== undefined && start !== undefined && end > start ? end : undefined,
    place: text(s.place, PLACE_MAX),
    brand: text(s.brand, PLACE_MAX),
    at: second(s.at),
  };
}

function unique<T>(items: unknown, parse: (v: unknown) => T | null, keyOf: (t: T) => string, max: number): T[] {
  const seen = new Set<string>();
  return (Array.isArray(items) ? items : [])
    .map(parse)
    .filter((t): t is T => {
      if (!t) return false;
      const k = keyOf(t);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, max);
}

// Model output is untrusted: unknown types dropped, lengths clamped, spots
// without a name and insights without text dropped, repeats kept once.
export function parseAnalysis(raw: unknown): VideoAnalysis | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const summary = text(r.summary, SUMMARY_MAX);
  if (!summary) return null;
  const spots = unique(r.spots, parseSpot, (s) => s.name.toLowerCase(), MAX_SPOTS);
  const insights = unique(r.insights, parseInsight, (i) => normalizeText(i.text), MAX_INSIGHTS);
  return { relevant: r.relevant !== false, summary, onScreen: text(r.onScreen, ON_SCREEN_MAX), spots, insights };
}

const strip = <T extends object>(o: T): T =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;

export function doneVideo(a: VideoAnalysis, model: string, attempts: number): IdeaVideo {
  return strip({
    status: "done" as const,
    relevant: a.relevant,
    summary: a.summary,
    onScreen: a.onScreen,
    spots: a.spots.map(strip),
    insights: a.insights?.map(strip),
    attempts,
    analyzedAt: new Date().toISOString(),
    model,
  });
}


// The caption, author and cover found with the video fill only what the idea
// lacks (an Instagram post, or an idea the assistant created).
export function withPostMeta(idea: Idea, meta: { title?: string; author?: string; thumbnail?: string } | undefined): Idea {
  if (!meta) return idea;
  return strip({ ...idea, title: idea.title ?? meta.title, author: idea.author ?? meta.author, thumbnail: idea.thumbnail ?? meta.thumbnail });
}

// The parent as it is now plus the analysis. Only `video` is written, and the
// rules suggestion is redone with what the video showed while the group hasn't
// decided (Claude's suggestion is kept), so a note, votes or a place set
// meanwhile survive.
export function withVideo(current: Idea, video: IdeaVideo, index: PlaceIndex | null): Idea {
  // A new analysis renumbers the insights: what the group said about the old ones goes.
  const next: Idea = { ...current, video, ...(video.status === "done" ? { insightStates: undefined } : {}) };
  if (!index || video.status !== "done" || (current.place && current.cat)) return next;
  if (current.suggestion?.source === "claude") return next;
  const { place, cat } = classifyIdeaFields(next, index);
  const suggestion = strip({ place: current.place ? undefined : place, cat: current.cat ? undefined : cat, source: "rules" as const });
  return suggestion.place || suggestion.cat ? { ...next, suggestion } : { ...next, suggestion: undefined };
}
