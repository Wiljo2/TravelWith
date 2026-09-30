import { IDEA_TYPES } from "@/constants/ideaTypes";
import type { PlaceProfiles } from "@/utils/ideas";
import type { Day, Idea, IdeaLink, IdeaSuggestion } from "@/types";

// Free, in-browser classification with a Hugging Face sentence-embedding model
// (Transformers.js). The model runs on the user's device: no API key, no server
// cost. First run downloads it (~118 MB, cached by the browser afterwards).
export const AI_MODEL = "Xenova/paraphrase-multilingual-MiniLM-L12-v2";
export const AI_DOWNLOAD_MB = 118;

// Calibrated on the demo trip: suggest only with a clear winner.
const PLACE_MIN_SCORE = 0.45;
const PLACE_MIN_MARGIN = 0.05;
const TYPE_MIN_SCORE = 0.4;
const TYPE_MIN_MARGIN = 0.05;
const EVENT_MIN_SCORE = 0.5;
const EVENT_MIN_MARGIN = 0.05;

export interface ClassifyRequest {
  type: "classify";
  model: string;
  items: { id: string; texts: string[] }[];
  targets: { group: string; key: string; texts: string[] }[];
}

// textIdx: which of the item's texts matched best (to quote it back).
export interface Match { key: string; score: number; margin: number; textIdx: number }

type Result = { id: string; matches: Record<string, Match> };

export type WorkerMessage =
  | { type: "progress"; phase: "download"; progress: number }
  | { type: "progress"; phase: "classify"; done: number; total: number }
  | { type: "result"; results: Result[] }
  | { type: "error"; message: string };

export type AIProgress = Extract<WorkerMessage, { type: "progress" }>;

const CHUNK_WORDS = 40;

// Texts the model reads for an idea. The member's note states the intent ("cena
// en Miami") and wins alone; otherwise the caption + hashtags and the transcript,
// cut in chunks because the model only reads ~128 tokens at a time.
export function ideaTexts(idea: Idea): string[] {
  const note = idea.note?.trim();
  if (note) return [note];
  const caption = [idea.title, idea.tags?.join(" ")].filter(Boolean).join(" · ").trim();
  const words = (idea.transcript ?? "").split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += CHUNK_WORDS) chunks.push(words.slice(i, i + CHUNK_WORDS).join(" "));
  return [caption, ...chunks].filter(Boolean);
}

export function ideaText(idea: Idea): string {
  return ideaTexts(idea).join(" ");
}

// True once the model was downloaded in this browser: running it is then instant
// and free of data costs, so the app can use it without asking.
export async function isModelCached(): Promise<boolean> {
  try {
    if (typeof caches === "undefined" || !(await caches.has("transformers-cache"))) return false;
    const keys = await (await caches.open("transformers-cache")).keys();
    return keys.some((r) => r.url.includes(AI_MODEL) && r.url.endsWith(".onnx"));
  } catch {
    return false;
  }
}

async function runWorker(
  items: ClassifyRequest["items"], targets: ClassifyRequest["targets"], onProgress: (p: AIProgress) => void,
): Promise<Result[]> {
  const worker = new Worker(new URL("../workers/ideaClassifier.worker.ts", import.meta.url), { type: "module" });
  try {
    return await new Promise<Result[]>((resolve, reject) => {
      worker.onmessage = (e: MessageEvent<WorkerMessage>) => {
        const msg = e.data;
        if (msg.type === "progress") onProgress(msg);
        else if (msg.type === "result") resolve(msg.results);
        else reject(new Error(msg.message));
      };
      worker.onerror = (e) => reject(new Error(e.message || "No se pudo cargar el modelo"));
      const request: ClassifyRequest = { type: "classify", model: AI_MODEL, items, targets };
      worker.postMessage(request);
    });
  } finally {
    worker.terminate();
  }
}

const accept = (m: Match | undefined, min: number, margin: number) => (m && m.score >= min && m.margin >= margin ? m : undefined);

// Place/type suggestions for ideas. Ideas without any text are skipped.
export async function suggestWithAI(
  ideas: Idea[], profiles: PlaceProfiles, onProgress: (p: AIProgress) => void,
): Promise<Map<string, IdeaSuggestion>> {
  const items = ideas.map((i) => ({ id: i.id, texts: ideaTexts(i) })).filter((i) => i.texts.length > 0);
  if (items.length === 0) return new Map();
  const results = await runWorker(items, [
    ...Object.entries(profiles).map(([key, texts]) => ({ group: "place", key, texts })),
    ...Object.entries(IDEA_TYPES).map(([key, t]) => ({ group: "cat", key, texts: t.prototypes })),
  ], onProgress);

  const suggestions = new Map<string, IdeaSuggestion>();
  for (const r of results) {
    const place = accept(r.matches.place, PLACE_MIN_SCORE, PLACE_MIN_MARGIN)?.key;
    const cat = accept(r.matches.cat, TYPE_MIN_SCORE, TYPE_MIN_MARGIN)?.key;
    if (place || cat) suggestions.set(r.id, { place, cat, source: "ai" });
  }
  return suggestions;
}

// Which itinerary activity each idea is most similar to, by meaning (free).
// `eventDays` restricts each idea to the days of its place when known.
export async function matchEventsWithAI(
  ideas: Idea[], days: Day[], allowedDays: (idea: Idea) => string[] | null, onProgress: (p: AIProgress) => void,
): Promise<IdeaLink[]> {
  const items = ideas.map((i) => ({ id: i.id, texts: ideaTexts(i) })).filter((i) => i.texts.length > 0);
  const events = days.flatMap((d) => d.events.map((ev) => ({ d, ev })));
  if (items.length === 0 || events.length === 0) return [];
  const results = await runWorker(
    items,
    events.map(({ ev }) => ({ group: "event", key: ev.id, texts: [`${ev.title}. ${ev.note}`.trim()] })),
    onProgress,
  );

  const links: IdeaLink[] = [];
  for (const r of results) {
    const m = accept(r.matches.event, EVENT_MIN_SCORE, EVENT_MIN_MARGIN);
    const idea = ideas.find((i) => i.id === r.id);
    const hit = m && events.find((e) => e.ev.id === m.key);
    if (!idea || !hit) continue;
    const allowed = allowedDays(idea);
    if (allowed && !allowed.includes(hit.d.id)) continue;
    const quoted = ideaTexts(idea)[m.textIdx];
    links.push({
      ideaId: idea.id,
      dayId: hit.d.id,
      eventId: hit.ev.id,
      reason: quoted ? `“${quoted.split(/\s+/).slice(0, 16).join(" ")}${quoted.split(/\s+/).length > 16 ? "…" : ""}”` : undefined,
      source: "ai",
    });
  }
  return links;
}
