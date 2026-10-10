import type { InsightKind, InsightPhase } from "@/types";

// What a group does with each piece of advice a reel gives. Places stay in the
// video's spots; these are everything else.
export interface InsightKindInfo {
  label: string;
  plural: string;
  icon: string;
}

export const INSIGHT_KINDS: Record<InsightKind, InsightKindInfo> = {
  todo: { label: "Por hacer", plural: "Por hacer", icon: "✅" },
  tip: { label: "Consejo", plural: "Consejos", icon: "💡" },
  avoid: { label: "Evitar", plural: "Evitar", icon: "⚠️" },
  fact: { label: "Dato", plural: "Datos", icon: "ℹ️" },
};

export const INSIGHT_KIND_ORDER: InsightKind[] = ["todo", "avoid", "tip", "fact"];

// When in the trip an insight matters, as the video says it.
export const INSIGHT_PHASES: Record<InsightPhase, string> = {
  before: "Antes del viaje",
  first: "Primer día",
  during: "Durante",
  last: "Último día",
  anytime: "Cuando sea",
};
