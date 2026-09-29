/// <reference lib="webworker" />
import { env, pipeline } from "@huggingface/transformers";
import type { ClassifyRequest, Match, WorkerMessage } from "@/lib/ideaAI";

// Models always come from the Hugging Face Hub (and are cached by the browser).
env.allowLocalModels = false;

const post = (msg: WorkerMessage) => self.postMessage(msg);
const dot = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * b[i], 0);

async function run(req: ClassifyRequest) {
  const extractor = await pipeline("feature-extraction", req.model, {
    dtype: "q8",
    progress_callback: (p) => {
      if (p.status === "progress_total") post({ type: "progress", phase: "download", progress: p.progress });
    },
  });
  const embed = async (texts: string[]) =>
    (await extractor(texts, { pooling: "mean", normalize: true })).tolist() as number[][];

  const targets: (ClassifyRequest["targets"][number] & { vecs: number[][] })[] = [];
  for (const t of req.targets) targets.push({ ...t, vecs: await embed(t.texts) });

  const results: { id: string; place?: Match; cat?: Match }[] = [];
  for (const [i, item] of req.items.entries()) {
    const vs = await embed(item.texts);
    // Score = best pair between the idea's texts (note, caption, transcript chunks)
    // and the target's texts (e.g. the closest activity of a place).
    const best = (group: "place" | "cat"): Match | undefined => {
      const ranked = targets
        .filter((t) => t.group === group)
        .map((t) => ({ key: t.key, score: Math.max(...vs.flatMap((v) => t.vecs.map((tv) => dot(tv, v)))) }))
        .sort((a, b) => b.score - a.score);
      if (ranked.length === 0) return undefined;
      return { ...ranked[0], margin: ranked[0].score - (ranked[1]?.score ?? 0) };
    };
    results.push({ id: item.id, place: best("place"), cat: best("cat") });
    post({ type: "progress", phase: "classify", done: i + 1, total: req.items.length });
  }
  post({ type: "result", results });
}

self.onmessage = (e: MessageEvent<ClassifyRequest>) => {
  run(e.data).catch((err: unknown) => post({ type: "error", message: err instanceof Error ? err.message : String(err) }));
};
