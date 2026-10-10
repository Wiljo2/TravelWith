import { INSIGHT_KINDS, INSIGHT_PHASES } from "@/constants/insightKinds";
import { fmtHour } from "@/utils/time";
import { insightId } from "@/utils/insights";
import type { Idea, IdeaLink, InsightLink, InsightStatus } from "@/types";

// The advice of the saved videos (their insights) in "Analizar con Claude":
// listed with labels n1, n2… after the ideas, and read back as InsightLinks.
// The model picks targets among the same labels as the ideas (e…, s…, D…).

export const MAX_INSIGHTS_PER_CALL = 120;
const STATUSES: InsightStatus[] = ["new", "covered", "na"];

export const INSIGHT_RULES = `
También recibes CONSEJOS (n1, n2…) que salieron de esos videos. Para cada consejo decides:
- target: la actividad (e…), el hueco libre (s…) o el día (D…) donde sirve, con las mismas reglas de lugar y tiempo; "none" si no aplica.
- before: true si hay que hacerlo antes del viaje (reservar, comprar, llevar, descargar).
- deadline: solo para lo que debe hacerse con anticipación ("60 días antes", "una semana antes"): la fecha límite AAAA-MM-DD calculada con las FECHAS del viaje; si no, "".
- status: "new" si aporta algo que el plan aún no tiene; "covered" si el itinerario ya lo contempla (una actividad, una nota o una reserva lo dice); "na" si no aplica a este viaje: otra naviera, otro barco, otro parque, un puerto o lugar que no visitan, el aeropuerto o la dirección de vuelo equivocada.
- reason: en español, máximo 16 palabras, por qué sirve ahí o por qué no aplica. Sin etiquetas.`;

export const INSIGHT_SCHEMA = {
  type: "array",
  items: {
    type: "object",
    properties: {
      insight: { type: "string" },
      target: { type: "string" },
      before: { type: "boolean" },
      deadline: { type: "string" },
      status: { type: "string", enum: STATUSES },
      reason: { type: "string" },
    },
    required: ["insight", "target", "before", "deadline", "status", "reason"],
    additionalProperties: false,
  },
};

const cut = (text: string | undefined, max: number) => {
  if (!text) return "";
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
};

// The videos whose insights are sent: analyzed, about travel, not discarded;
// with `onlyIds`, those videos or the ones whose spot ideas are listed.
export function insightSources(ideas: Idea[], onlyIds?: string[]): Idea[] {
  const only = onlyIds && new Set(onlyIds);
  const parentsOfOnly = new Set(ideas.filter((i) => i.parentId && only?.has(i.id)).map((i) => i.parentId));
  return ideas.filter((i) =>
    !i.parentId && i.status !== "discarded" && i.video?.status === "done" && i.video.relevant !== false
    && (i.video.insights?.length ?? 0) > 0 && (!only || only.has(i.id) || parentsOfOnly.has(i.id)));
}

export function describeInsights(sources: Idea[]) {
  const labels = new Map<string, string>();
  const lines: string[] = [];
  for (const video of sources) {
    for (const [n, ins] of (video.video?.insights ?? []).entries()) {
      if (labels.size >= MAX_INSIGHTS_PER_CALL) break;
      const label = `n${labels.size + 1}`;
      labels.set(label, insightId(video.id, n));
      const hours = ins.start !== undefined ? `${fmtHour(ins.start)}${ins.end !== undefined ? `–${fmtHour(ins.end)}` : ""}` : "";
      const meta = [
        ins.phase && INSIGHT_PHASES[ins.phase].toLowerCase(),
        ins.when && `cuándo: ${ins.when}`,
        hours,
        ins.place && `lugar: ${ins.place}`,
        ins.brand && `de: ${ins.brand}`,
      ].filter(Boolean).join(" · ");
      lines.push(`${label} [${INSIGHT_KINDS[ins.kind].label}] ${ins.text}${meta ? ` · ${meta}` : ""} (video: ${cut(video.note || video.title, 60) || video.platform})`);
    }
  }
  return { labels, text: lines.join("\n") };
}

type Target = Omit<IdeaLink, "ideaId" | "reason" | "source" | "before">;
export type InsightAnswer = { insight: string; target: string; before: boolean; deadline: string; status: string; reason: string };

// Unknown labels are dropped; a deadline must be a real date before the trip ends.
export function readInsightAnswers(
  answers: InsightAnswer[], labels: Map<string, string>, targets: Map<string, Target>, tripEnd?: string,
): InsightLink[] {
  const out: InsightLink[] = [];
  for (const a of answers) {
    const id = labels.get(a.insight?.trim());
    if (!id || out.some((l) => l.insightId === id)) continue;
    const status = STATUSES.includes(a.status as InsightStatus) ? (a.status as InsightStatus) : "new";
    const target = status === "na" ? undefined : targets.get(a.target?.trim());
    const deadline = /^\d{4}-\d{2}-\d{2}$/.test(a.deadline ?? "") && !Number.isNaN(Date.parse(a.deadline))
      && (!tripEnd || a.deadline <= tripEnd) ? a.deadline : undefined;
    out.push({
      insightId: id,
      ...target,
      ...(a.before ? { before: true } : {}),
      ...(deadline ? { deadline } : {}),
      status,
      ...(a.reason?.trim() ? { reason: cut(a.reason, 160) } : {}),
    });
  }
  return out;
}
