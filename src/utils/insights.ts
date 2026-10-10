import { INSIGHT_KINDS, INSIGHT_KIND_ORDER, INSIGHT_PHASES } from "@/constants/insightKinds";
import { CRUISE_PLACE, normalizeText, vocab } from "@/utils/ideas";
import { fmtHour } from "@/utils/time";
import type { Idea, IdeaInsight, IdeaSpot, InsightPhase } from "@/types";

export interface Contribution {
  icon: string;
  count: number;
  label: string;
}

// What an analyzed video brings, as short counts for its card: "✅1 💡4 📍2".
// [] = analyzed and nothing concrete; undefined = not analyzed (or a spot idea).
export function videoContribution(idea: Idea): Contribution[] | undefined {
  const v = idea.video;
  if (idea.spot || v?.status !== "done") return undefined;
  if (v.relevant === false) return [];
  const insights = v.insights ?? [];
  const parts = INSIGHT_KIND_ORDER.map((kind) => ({
    icon: INSIGHT_KINDS[kind].icon,
    count: insights.filter((i) => i.kind === kind).length,
    label: INSIGHT_KINDS[kind].plural,
  }));
  parts.push({ icon: "📍", count: v.spots?.length ?? 0, label: "Lugares" });
  return parts.filter((p) => p.count > 0);
}

// When an insight matters, in one line: "11:30–13:00 · el día de embarque · Royal Caribbean".
export const insightMeta = (i: IdeaInsight) =>
  [
    i.start !== undefined && (i.end !== undefined ? `${fmtHour(i.start)}–${fmtHour(i.end)}` : fmtHour(i.start)),
    i.when,
    i.brand,
  ].filter(Boolean).join(" · ");

// One piece of advice on a destination's digest, with every video that says it.
export interface DigestInsight {
  id: string;               // `${ideaId}:i${index}` of the first video that says it
  insight: IdeaInsight;
  ideaId: string;
  sources: string[];        // ids of the videos that say it
}

export interface DigestSpot {
  spot: IdeaSpot;
  ideaId: string;
  sources: string[];
}

export interface ZoneDigest {
  videos: Idea[];
  insights: DigestInsight[];
  spots: DigestSpot[];
}

export const insightId = (ideaId: string, index: number) => `${ideaId}:i${index}`;

const SAME_TEXT = 0.6;

function sameText(a: string, b: string): boolean {
  const x = new Set(vocab(a));
  const y = new Set(vocab(b));
  if (!x.size || !y.size) return normalizeText(a) === normalizeText(b);
  let common = 0;
  for (const w of x) if (y.has(w)) common++;
  return common / (x.size + y.size - common) >= SAME_TEXT;
}

// The zone a video belongs to: a video split into spot ideas goes where most
// of its spots are; otherwise where the video itself is.
function videoZone(video: Idea, children: Idea[], zoneOf: (i: Idea) => string): string {
  if (!children.length) return zoneOf(video);
  const count = new Map<string, number>();
  for (const c of children) count.set(zoneOf(c), (count.get(zoneOf(c)) ?? 0) + 1);
  return [...count.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

// Everything the saved videos say, by zone: their insights (the same advice
// said by several videos counted once) and the places they recommend.
export function collectInsights(ideas: Idea[], zoneOf: (i: Idea) => string): Map<string, ZoneDigest> {
  const active = ideas.filter((i) => i.status !== "discarded");
  const children = new Map<string, Idea[]>();
  for (const i of active) if (i.parentId) children.set(i.parentId, [...(children.get(i.parentId) ?? []), i]);
  const out = new Map<string, ZoneDigest>();
  for (const video of active.filter((i) => !i.parentId)) {
    const zone = videoZone(video, children.get(video.id) ?? [], zoneOf);
    const digest = out.get(zone) ?? { videos: [], insights: [], spots: [] };
    out.set(zone, digest);
    digest.videos.push(video);
    const v = video.video;
    if (v?.status !== "done" || v.relevant === false) continue;
    (v.insights ?? []).forEach((insight, n) => {
      const same = digest.insights.find((d) => d.insight.kind === insight.kind && sameText(d.insight.text, insight.text));
      if (same) { if (!same.sources.includes(video.id)) same.sources.push(video.id); return; }
      digest.insights.push({ id: insightId(video.id, n), insight, ideaId: video.id, sources: [video.id] });
    });
    for (const spot of v.spots ?? []) {
      const same = digest.spots.find((d) => normalizeText(d.spot.name) === normalizeText(spot.name));
      if (same) { if (!same.sources.includes(video.id)) same.sources.push(video.id); continue; }
      digest.spots.push({ spot, ideaId: video.id, sources: [video.id] });
    }
  }
  return out;
}

// The moments of a destination, in trip order, for its advice ("Embarque",
// "Durante"…). A cruise names its first and last day after boarding.
export const MOMENT_ORDER: InsightPhase[] = ["before", "first", "during", "last", "anytime"];

export function momentLabel(phase: InsightPhase, zone: string): string {
  if (zone === CRUISE_PLACE && phase === "first") return "Embarque";
  if (zone === CRUISE_PLACE && phase === "last") return "Desembarque";
  return INSIGHT_PHASES[phase];
}

// Advice grouped by moment, each group in time-of-day order.
export function byMoment(items: DigestInsight[]): { phase: InsightPhase; items: DigestInsight[] }[] {
  return MOMENT_ORDER
    .map((phase) => ({
      phase,
      items: items
        .filter((d) => (d.insight.phase ?? "anytime") === phase)
        .sort((a, b) => (a.insight.start ?? 99) - (b.insight.start ?? 99)),
    }))
    .filter((g) => g.items.length > 0);
}
