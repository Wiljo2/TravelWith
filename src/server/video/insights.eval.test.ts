import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { vocab } from "@/utils/ideas";
import type { Idea, IdeaPlatform } from "@/types";

// Live eval of the video prompt against a hand-annotated gold set. Calls the
// real providers, so it only runs with RUN_VIDEO_EVAL=1 and a Gemini key.

const ON = process.env.RUN_VIDEO_EVAL === "1" && !!process.env.GEMINI_API_KEY;
const DIR = path.resolve(__dirname, "../../../evals/reel-insights");

interface Expected { kind?: string; text: string }
interface Case {
  url: string;
  places: string[];
  caption?: string;
  expected: { insights?: Expected[]; spots?: string[] };
}

const overlap = (a: string, b: string) => {
  const x = new Set(vocab(a));
  const y = new Set(vocab(b));
  if (!x.size || !y.size) return a.toLowerCase().trim() === b.toLowerCase().trim() ? 1 : 0;
  let common = 0;
  for (const w of x) if (y.has(w)) common++;
  return common / Math.min(x.size, y.size);
};

function score(expected: string[], found: string[]) {
  const used = new Set<number>();
  let hits = 0;
  for (const e of expected) {
    const i = found.findIndex((f, n) => !used.has(n) && overlap(e, f) >= 0.5);
    if (i >= 0) { used.add(i); hits++; }
  }
  return { expected: expected.length, found: hits, missed: expected.length - hits, invented: found.length - used.size };
}

const platformOf = (url: string): IdeaPlatform =>
  url.includes("tiktok.com") ? "tiktok" : url.includes("instagram.com") ? "instagram" : "other";

describe.skipIf(!ON)("video insights eval", () => {
  it("scores the gold set", async () => {
    const { resolveVideo } = await import("@/server/video/sources");
    const { watchVideo } = await import("@/server/video/gemini");
    const cases = JSON.parse(readFileSync(path.join(DIR, "cases.json"), "utf8")) as Case[];
    mkdirSync(path.join(DIR, "out"), { recursive: true });
    const rows: Record<string, unknown>[] = [];
    for (const [n, c] of cases.entries()) {
      const idea: Idea = { id: `eval-${n}`, url: c.url, platform: platformOf(c.url), createdAt: new Date().toISOString(), title: c.caption };
      const resolved = await resolveVideo(idea, "eval", 90);
      if (!resolved.ok) { rows.push({ url: c.url, error: resolved.reason }); continue; }
      const result = await watchVideo(resolved.input, { places: c.places, caption: c.caption }, Date.now() + 240_000);
      writeFileSync(path.join(DIR, "out", `${n}.json`), JSON.stringify(result.analysis, null, 2));
      const insights = result.analysis.insights ?? [];
      rows.push({
        url: c.url,
        insights: score((c.expected.insights ?? []).map((e) => e.text), insights.map((i) => i.text)),
        spots: score(c.expected.spots ?? [], result.analysis.spots.map((s) => s.name)),
        tokens: result.usage.input + result.usage.output,
      });
    }
    console.table(rows.map((r) => ({ ...r, insights: JSON.stringify(r.insights), spots: JSON.stringify(r.spots) })));
    expect(rows.length).toBe(cases.length);
  }, 30 * 60_000);
});
