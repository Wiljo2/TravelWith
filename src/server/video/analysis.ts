import { IDEA_TYPES } from "@/constants/ideaTypes";
import { classifyIdeaFields, type PlaceIndex } from "@/utils/ideas";
import type { Idea, IdeaSpot, IdeaVideo } from "@/types";

// What Gemini returns for a video, validated, and how it lands on the ideas:
// the parent keeps the summary and the spots; with two or more spots, each one
// also becomes a child idea the group can place, vote and plan on its own.

export const MAX_SPOTS = 12;
const SUMMARY_MAX = 600;
const ON_SCREEN_MAX = 600;
const NAME_MAX = 80;
const CITY_MAX = 60;
const PRICE_MAX = 40;
const TIP_MAX = 200;
const CATS = Object.keys(IDEA_TYPES);

export interface VideoAnalysis {
  relevant: boolean;
  summary: string;
  onScreen?: string;
  spots: IdeaSpot[];
}

// Gemini responseSchema (OpenAPI subset).
export const ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    relevant: { type: "boolean" },
    summary: { type: "string" },
    onScreen: { type: "string" },
    spots: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          city: { type: "string" },
          cat: { type: "string", enum: CATS },
          at: { type: "number" },
          price: { type: "string" },
          tip: { type: "string" },
        },
        required: ["name", "cat"],
      },
    },
  },
  required: ["relevant", "summary", "spots"],
};

export function analysisPrompt(places: string[]): string {
  const list = places.length ? places.join(", ") : "(sin lugares definidos)";
  return `Mira este video que un grupo guardó como inspiración para su viaje (imagen y audio). Responde en español.
- relevant: true si da ideas útiles para viajar (lugares, comida, actividades, compras, tips); false si trata de otra cosa.
- summary: qué muestra y recomienda, máximo ${SUMMARY_MAX} caracteres.
- onScreen: el texto importante que aparece en pantalla (nombres, precios, direcciones), máximo ${ON_SCREEN_MAX} caracteres.
- spots: cada lugar, negocio o experiencia concreta que recomienda (máximo ${MAX_SPOTS}), en el orden en que aparecen:
  name (nombre propio), city, cat (${CATS.join(", ")}), at (segundo del video donde aparece), price y tip si se dicen o se ven.
  Si el lugar queda en uno de estos lugares del viaje, usa ese nombre exacto en city: ${list}.
  Un tip general sin lugar concreto no es un spot.
No inventes: solo lo que se ve o se oye.`;
}

const text = (v: unknown, max: number): string | undefined => {
  if (typeof v !== "string") return undefined;
  const t = v.replace(/\s+/g, " ").trim();
  if (!t) return undefined;
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
};

function parseSpot(v: unknown): IdeaSpot | null {
  if (typeof v !== "object" || v === null) return null;
  const s = v as Record<string, unknown>;
  const name = text(s.name, NAME_MAX);
  if (!name) return null;
  const at = typeof s.at === "number" && Number.isFinite(s.at) && s.at >= 0 ? Math.round(s.at) : undefined;
  const cat = typeof s.cat === "string" && CATS.includes(s.cat) ? s.cat : undefined;
  return {
    name,
    city: text(s.city, CITY_MAX),
    cat,
    at,
    price: text(s.price, PRICE_MAX),
    tip: text(s.tip, TIP_MAX),
  };
}

// Model output is untrusted: unknown types dropped, lengths clamped, spots
// without a name dropped, repeated names kept once.
export function parseAnalysis(raw: unknown): VideoAnalysis | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const summary = text(r.summary, SUMMARY_MAX);
  if (!summary) return null;
  const seen = new Set<string>();
  const spots = (Array.isArray(r.spots) ? r.spots : [])
    .map(parseSpot)
    .filter((s): s is IdeaSpot => {
      if (!s || seen.has(s.name.toLowerCase())) return false;
      seen.add(s.name.toLowerCase());
      return true;
    })
    .slice(0, MAX_SPOTS);
  return { relevant: r.relevant !== false, summary, onScreen: text(r.onScreen, ON_SCREEN_MAX), spots };
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
    attempts,
    analyzedAt: new Date().toISOString(),
    model,
  });
}

// Child ids derive from the parent, so analyzing again never duplicates them.
export const childId = (parentId: string, i: number) => `${parentId.slice(0, 95)}-s${i}`;

// Only a travel video with two or more spots is split into ideas.
export function childIdeas(parent: Idea, analysis: VideoAnalysis, index: PlaceIndex): Idea[] {
  if (!analysis.relevant || analysis.spots.length < 2 || parent.parentId) return [];
  const createdAt = new Date().toISOString();
  return analysis.spots.map((spot, i) => {
    const child: Idea = strip({
      id: childId(parent.id, i),
      url: parent.url,
      platform: parent.platform,
      createdAt,
      title: spot.name,
      author: parent.author,
      thumbnail: parent.thumbnail,
      embedId: parent.embedId,
      addedBy: parent.addedBy,
      status: "idea" as const,
      parentId: parent.id,
      spot: strip(spot),
    });
    const { place, cat } = classifyIdeaFields(child, index);
    return place || cat ? { ...child, suggestion: strip({ place, cat, source: "rules" as const }) } : child;
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
  const next: Idea = { ...current, video };
  if (!index || video.status !== "done" || (current.place && current.cat)) return next;
  if (current.suggestion?.source === "claude") return next;
  const { place, cat } = classifyIdeaFields(next, index);
  const suggestion = strip({ place: current.place ? undefined : place, cat: current.cat ? undefined : cat, source: "rules" as const });
  return suggestion.place || suggestion.cat ? { ...next, suggestion } : { ...next, suggestion: undefined };
}
