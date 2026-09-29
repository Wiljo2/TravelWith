import { IDEA_TYPES } from "@/constants/ideaTypes";
import type { PlaceProfiles } from "@/utils/ideas";
import type { Idea, IdeaSuggestion } from "@/types";

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

export interface ClassifyRequest {
  type: "classify";
  model: string;
  items: { id: string; texts: string[] }[];
  targets: { group: "place" | "cat"; key: string; texts: string[] }[];
}

export interface Match { key: string; score: number; margin: number }

export type WorkerMessage =
  | { type: "progress"; phase: "download"; progress: number }
  | { type: "progress"; phase: "classify"; done: number; total: number }
  | { type: "result"; results: { id: string; place?: Match; cat?: Match }[] }
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

// Runs the model in a Web Worker and returns place/type suggestions. Ideas
// without any text are skipped.
export async function suggestWithAI(
  ideas: Idea[], profiles: PlaceProfiles, onProgress: (p: AIProgress) => void,
): Promise<Map<string, IdeaSuggestion>> {
  const items = ideas.map((i) => ({ id: i.id, texts: ideaTexts(i) })).filter((i) => i.texts.length > 0);
  if (items.length === 0) return new Map();

  const targets: ClassifyRequest["targets"] = [
    ...Object.entries(profiles).map(([key, texts]) => ({ group: "place" as const, key, texts })),
    ...Object.entries(IDEA_TYPES).map(([key, t]) => ({ group: "cat" as const, key, texts: t.prototypes })),
  ];

  const worker = new Worker(new URL("../workers/ideaClassifier.worker.ts", import.meta.url), { type: "module" });
  try {
    const results = await new Promise<Extract<WorkerMessage, { type: "result" }>["results"]>((resolve, reject) => {
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

    const suggestions = new Map<string, IdeaSuggestion>();
    for (const r of results) {
      const place = r.place && r.place.score >= PLACE_MIN_SCORE && r.place.margin >= PLACE_MIN_MARGIN ? r.place.key : undefined;
      const cat = r.cat && r.cat.score >= TYPE_MIN_SCORE && r.cat.margin >= TYPE_MIN_MARGIN ? r.cat.key : undefined;
      if (place || cat) suggestions.set(r.id, { place, cat, source: "ai" });
    }
    return suggestions;
  } finally {
    worker.terminate();
  }
}
