import { INSIGHT_KINDS, INSIGHT_KIND_ORDER, INSIGHT_PHASES } from "@/constants/insightKinds";
import { CRUISE_PLACE, normalizeText, vocab } from "@/utils/ideas";
import { MONTHS } from "@/utils/tripDays";
import { fmtHour } from "@/utils/time";
import type { Day, Idea, IdeaInsight, IdeaSpot, InsightLink, InsightPhase, InsightState, Task } from "@/types";

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
  ids: string[];            // every insight merged into this one
  conflicts?: string[];     // what other videos say against it
  link?: InsightLink;        // where "Analizar con Claude" placed it
  index: number;            // position in the first video's insights
  state?: InsightState;     // the group's votes or hiding, kept on that video
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
export const insightIdeaId = (id: string) => id.slice(0, id.lastIndexOf(":i"));

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
export function collectInsights(ideas: Idea[], zoneOf: (i: Idea) => string, links: InsightLink[] = []): Map<string, ZoneDigest> {
  const linkOf = new Map(links.map((l) => [l.insightId, l]));
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
      const link = linkOf.get(insightId(video.id, n));
      if (same) {
        if (!same.sources.includes(video.id)) same.sources.push(video.id);
        same.link ??= link;
        same.ids.push(insightId(video.id, n));
        return;
      }
      const state = video.insightStates?.[n];
      digest.insights.push({ id: insightId(video.id, n), ids: [insightId(video.id, n)], insight, ideaId: video.id, index: n, sources: [video.id], ...(link ? { link } : {}), ...(state ? { state } : {}) });
    });
    for (const spot of v.spots ?? []) {
      const same = digest.spots.find((d) => normalizeText(d.spot.name) === normalizeText(spot.name));
      if (same) { if (!same.sources.includes(video.id)) same.sources.push(video.id); continue; }
      digest.spots.push({ spot, ideaId: video.id, sources: [video.id] });
    }
  }
  for (const digest of out.values()) mergeByLinks(digest);
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


export interface MomentGroup {
  key: string;
  label: string;
  items: DigestInsight[];
}

// Advice grouped where Claude placed it — before the trip, then each day of
// the itinerary in order — or, before any analysis, by the moment the video
// names. Within a group, by hour (its own, or its activity's).
export function momentGroups(items: DigestInsight[], days: Day[], zone: string): MomentGroup[] {
  const groups = new Map<string, MomentGroup & { order: number }>();
  const startOf = (d: DigestInsight) => {
    const ev = d.link?.eventId ? days.find((day) => day.id === d.link!.dayId)?.events.find((e) => e.id === d.link!.eventId) : undefined;
    return d.insight.start ?? d.link?.slot?.start ?? ev?.start ?? 99;
  };
  for (const item of items) {
    const l = item.link;
    const dayIdx = l?.dayId ? days.findIndex((d) => d.id === l.dayId) : -1;
    let key: string;
    let label: string;
    let order: number;
    if (l?.before || (dayIdx < 0 && item.insight.phase === "before")) {
      [key, label, order] = ["before", INSIGHT_PHASES.before, -1];
    } else if (dayIdx >= 0) {
      const day = days[dayIdx];
      [key, label, order] = [`d:${day.id}`, [day.label, day.sub].filter(Boolean).join(" · "), dayIdx];
    } else {
      const phase = item.insight.phase ?? "anytime";
      [key, label, order] = [`p:${phase}`, momentLabel(phase, zone), 1000 + MOMENT_ORDER.indexOf(phase)];
    }
    const group = groups.get(key) ?? { key, label, order, items: [] };
    groups.set(key, group);
    group.items.push(item);
  }
  return [...groups.values()]
    .sort((a, b) => a.order - b.order)
    .map(({ key, label, items: list }) => ({ key, label, items: [...list].sort((a, b) => startOf(a) - startOf(b)) }));
}

// "antes de Sep 11": a todo's deadline, written like the itinerary's dates.
export function fmtDeadline(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `antes de ${MONTHS[m - 1]} ${d}`;
}

// A video insight Claude placed on a day or activity of the plan.
export interface PlacedInsight {
  id: string;
  insight: IdeaInsight;
  idea: Idea;
  link: InsightLink;
}

// The new advice placed on the plan, for the calendar, the activity and "Hoy".
// Links to insights that no longer exist (a video analyzed again) are skipped.
export function placedInsights(ideas: Idea[], links: InsightLink[] | undefined): PlacedInsight[] {
  if (!links?.length) return [];
  const byId = new Map(ideas.map((i) => [i.id, i]));
  return links.flatMap((link) => {
    if (link.status !== "new" || !link.dayId) return [];
    const idea = byId.get(insightIdeaId(link.insightId));
    const index = Number(link.insightId.slice(link.insightId.lastIndexOf(":i") + 2));
    const insight = idea?.video?.insights?.[index];
    return idea && insight && idea.status !== "discarded" ? [{ id: link.insightId, insight, idea, link }] : [];
  });
}

export function countByEvent(placed: PlacedInsight[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of placed) if (p.link.eventId) out[p.link.eventId] = (out[p.link.eventId] ?? 0) + 1;
  return out;
}

const URGENT_DAYS = 14;

// A todo from the videos as a task of the group: its text, when and why in the
// note with the video link, high priority when the deadline is close.
export function insightTask(item: DigestInsight, videoUrl: string, now = new Date()): Pick<Task, "title" | "note" | "priority"> {
  const deadline = item.link?.deadline;
  const days = deadline ? (Date.parse(`${deadline}T12:00:00`) - now.getTime()) / 86_400_000 : Infinity;
  const note = [
    [item.insight.when, deadline && fmtDeadline(deadline)].filter(Boolean).join(" · "),
    item.link?.reason,
    `Del video: ${videoUrl}`,
  ].filter(Boolean).join("\n");
  return { title: item.insight.text, note, priority: days <= URGENT_DAYS ? "alta" : "media" };
}

export const hasTaskFor = (tasks: Task[], item: DigestInsight) =>
  tasks.some((t) => normalizeText(t.title) === normalizeText(item.insight.text));

// The group's guide, to paste in a chat: the advice someone voted, by
// destination and moment of the trip. "" when nobody has voted yet.
export function tripGuideText(zones: { title: string; zone: string; digest: ZoneDigest }[], days: Day[]): string {
  const blocks = zones.flatMap(({ title, zone, digest }) => {
    const voted = digest.insights.filter((i) => (i.state?.votes?.length ?? 0) > 0 && !i.state?.hidden && i.link?.status !== "na");
    if (!voted.length) return [];
    const lines = momentGroups(voted, days, zone).flatMap((g) => [
      `${g.label}:`,
      ...g.items.map((i) => {
        const meta = [insightMeta(i.insight), i.link?.deadline && fmtDeadline(i.link.deadline)].filter(Boolean).join(" · ");
        return `${INSIGHT_KINDS[i.insight.kind].icon} ${i.insight.text}${meta ? ` (${meta})` : ""}`;
      }),
    ]);
    return [`📍 ${title}`, ...lines].join("\n");
  });
  return blocks.length ? ["Guía del viaje — lo que el grupo marcó de los videos", ...blocks].join("\n\n") : "";
}

// Claude's reading across videos: advice that says the same in other words is
// merged into the earlier one; advice that says the opposite is flagged on both.
function mergeByLinks(d: ZoneDigest) {
  const owner = (id: string) => d.insights.find((x) => x.ids.includes(id));
  for (const item of [...d.insights]) {
    const target = item.link?.sameAs ? owner(item.link.sameAs) : undefined;
    if (!target || target === item) continue;
    for (const s of item.sources) if (!target.sources.includes(s)) target.sources.push(s);
    target.ids.push(...item.ids);
    d.insights.splice(d.insights.indexOf(item), 1);
  }
  for (const item of d.insights) {
    const opposite = item.link?.contradicts ? owner(item.link.contradicts) : undefined;
    if (!opposite || opposite === item) continue;
    item.conflicts = [...new Set([...(item.conflicts ?? []), opposite.insight.text])];
    opposite.conflicts = [...new Set([...(opposite.conflicts ?? []), item.insight.text])];
  }
}
