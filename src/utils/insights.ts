import { INSIGHT_KINDS, INSIGHT_KIND_ORDER } from "@/constants/insightKinds";
import { fmtHour } from "@/utils/time";
import type { Idea, IdeaInsight } from "@/types";

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
