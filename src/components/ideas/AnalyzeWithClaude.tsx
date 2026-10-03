"use client";
import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Idea, IdeaLink, IdeaPlanResult } from "@/types";

interface AnalyzeWithClaudeProps {
  ideas: Idea[];               // active ideas
  reading: number;             // ideas whose video is still being read
  planLinks?: IdeaLink[];
  planLinksAt?: string;
  planIdeaIds?: string[];      // ideas the last analysis read
  // Runs the analysis on the server (only `ideaIds` when given).
  onAnalyze: (ideaIds?: string[]) => Promise<IdeaPlanResult>;
  onSavePlan: (links: IdeaLink[], at: string, ideaIds: string[]) => void;
  onApplyClaude: (classes: IdeaPlanResult["classes"]) => void;
}

// "Analizar con Claude": one pass that gives every idea its place, type and
// moment in the plan. Both views (by place, by day) read from its answer.
export default function AnalyzeWithClaude({
  ideas, reading, planLinks, planLinksAt, planIdeaIds, onAnalyze, onSavePlan, onApplyClaude,
}: AnalyzeWithClaudeProps) {
  const [state, setState] = useState<"idle" | "running" | { error: string }>("idle");
  // Analyses saved before the ids were recorded fall back to the linked ideas.
  const analyzedIds = new Set(planIdeaIds ?? (planLinks ?? []).map((l) => l.ideaId));
  const fresh = planLinksAt ? ideas.filter((i) => !analyzedIds.has(i.id)) : ideas;
  const onlyNew = !!planLinksAt && fresh.length > 0;

  // With a previous analysis, only the new ideas are sent (cheaper); the rest
  // keep their links. "todo de nuevo" re-reads everything (e.g. after plan changes).
  async function analyze(newOnly: boolean) {
    setState("running");
    try {
      const ids = newOnly ? fresh.map((i) => i.id) : undefined;
      const { links: next, classes, at, ideaIds: read } = await onAnalyze(ids);
      const kept = ids ? (planLinks ?? []).filter((l) => !ids.includes(l.ideaId)) : [];
      onSavePlan([...kept, ...next], at, ids ? [...new Set([...analyzedIds, ...read])] : read);
      onApplyClaude(classes);
      setState("idle");
    } catch (e) {
      setState({ error: e instanceof Error ? e.message : "No se pudo analizar" });
    }
  }

  const running = state === "running";
  const label = running ? "Analizando…"
    : onlyNew ? `Analizar ${fresh.length === 1 ? "la nueva" : `${fresh.length} nuevas`}`
      : planLinksAt ? "Analizar de nuevo" : "Analizar con Claude";

  return (
    <div className="flex min-w-0 items-center gap-2">
      <Button
        variant="outline"
        onClick={() => analyze(onlyNew)}
        disabled={running || reading > 0 || ideas.length === 0}
        className="h-9 shrink-0 gap-1.5 rounded-full bg-card"
      >
        {running ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4 text-emerald-700" />}
        {label}
      </Button>
      <span className="min-w-0 text-[11px] leading-tight text-muted-foreground">
        {typeof state === "object" ? <span className="text-destructive">{state.error}</span>
          : reading > 0 ? "Esperando a que termine de leer los videos…"
            : planLinksAt ? (
              <>
                {new Date(planLinksAt).toLocaleDateString("es-CO", { day: "numeric", month: "short" })}
                {onlyNew && !running && (
                  <> · <button onClick={() => analyze(false)} className="cursor-pointer underline underline-offset-2 hover:text-foreground">todo de nuevo</button></>
                )}
              </>
            )
              : "Lugar, tipo y momento de cada idea"}
      </span>
    </div>
  );
}
