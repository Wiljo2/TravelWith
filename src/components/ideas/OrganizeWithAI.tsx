"use client";
import { useState } from "react";
import { WandSparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AI_DOWNLOAD_MB, ideaText, suggestWithAI } from "@/lib/ideaAI";
import type { AIProgress } from "@/lib/ideaAI";
import type { Idea, IdeaSuggestion } from "@/types";
import type { PlaceProfiles } from "@/utils/ideas";

interface OrganizeWithAIProps {
  ideas: Idea[];          // ideas still missing a confirmed place or type
  profiles: PlaceProfiles;
  // Returns how many ideas got a new suggestion (existing ones are kept).
  onApply: (suggestions: Map<string, IdeaSuggestion>) => number;
  // Fetches a TikTok's caption, hashtags and transcript; resolves with the enriched idea.
  onEnrich: (idea: Idea) => Promise<Idea | null>;
}

type Enriching = { done: number; total: number };

type State =
  | { step: "closed" }
  | { step: "confirm" }
  | { step: "running"; progress: AIProgress | null; enriching?: Enriching }
  | { step: "done"; count: number }
  | { step: "error"; message: string };

function progressLabel(p: AIProgress | null, enriching?: Enriching): { label: string; pct: number } {
  if (enriching) {
    return { label: `Leyendo lo que dicen los videos… ${enriching.done} de ${enriching.total}`, pct: (enriching.done / enriching.total) * 20 };
  }
  if (!p) return { label: "Preparando el modelo…", pct: 20 };
  if (p.phase === "download") return { label: `Cargando el modelo… ${Math.round(p.progress)}%`, pct: 20 + p.progress * 0.6 };
  return { label: `Clasificando ${p.done} de ${p.total}…`, pct: 80 + (p.done / p.total) * 20 };
}

// Free classification with a Hugging Face model that runs in the browser.
export default function OrganizeWithAI({ ideas, profiles, onApply, onEnrich }: OrganizeWithAIProps) {
  const [state, setState] = useState<State>({ step: "closed" });

  async function run() {
    setState({ step: "running", progress: null });
    try {
      // TikToks saved before transcripts existed: read what the video says first.
      const pending = ideas.filter((i) => i.platform === "tiktok" && i.transcript === undefined);
      const enriched = new Map<string, Idea>();
      for (const [n, idea] of pending.entries()) {
        setState({ step: "running", progress: null, enriching: { done: n, total: pending.length } });
        const updated = await onEnrich(idea);
        if (updated) enriched.set(idea.id, updated);
      }
      const latest = ideas.map((i) => enriched.get(i.id) ?? i);
      const suggestions = await suggestWithAI(latest, profiles, (progress) => setState({ step: "running", progress }));
      setState({ step: "done", count: onApply(suggestions) });
    } catch (e) {
      setState({ step: "error", message: e instanceof Error ? e.message : "Error desconocido" });
    }
  }

  const withoutText = ideas.filter((i) => !ideaText(i).trim()).length;
  const skipNote = withoutText > 0
    ? ` ${withoutText === 1 ? "1 idea no tiene" : `${withoutText} ideas no tienen`} texto (ni del post ni nota) y no se puede${withoutText === 1 ? "" : "n"} clasificar: escríbele${withoutText === 1 ? "" : "s"} una nota.`
    : "";
  const open = state.step !== "closed";
  const close = () => { if (state.step !== "running") setState({ step: "closed" }); };
  const progress = state.step === "running" ? progressLabel(state.progress, state.enriching) : null;

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setState({ step: "confirm" })}
        disabled={ideas.length === 0}
        className="h-9 gap-1.5 rounded-full bg-card"
      >
        <WandSparkles className="size-4" />
        <span className="hidden sm:inline">Organizar con IA</span>
        <span className="sm:hidden">Con IA</span>
      </Button>

      <Dialog open={open} onOpenChange={(o) => { if (!o) close(); }}>
        <DialogContent className="max-w-[400px]" showCloseButton={state.step !== "running"}>
          <DialogHeader>
            <DialogTitle>Organizar ideas con IA</DialogTitle>
            <DialogDescription className="leading-normal">
              {state.step === "confirm" && (
                <>
                  Un modelo gratuito de Hugging Face lee el texto de {ideas.length === 1 ? "la idea" : `las ${ideas.length} ideas`} sin
                  clasificar y sugiere lugar y tipo (comida, actividad, tip…) usando los lugares del viaje. Corre en este dispositivo: nada sale de tu
                  navegador.
                  <br /><br />
                  La primera vez descarga ~{AI_DOWNLOAD_MB} MB (queda guardado). Mejor con WiFi o desde el computador. Las
                  sugerencias quedan para todo el grupo.
                  {skipNote && <><br /><br /><strong className="font-medium text-foreground">Ojo:</strong>{skipNote}</>}
                </>
              )}
              {state.step === "running" && "No cierres esta ventana."}
              {state.step === "done" && (state.count > 0
                ? `Listo: ${state.count} ${state.count === 1 ? "sugerencia nueva" : "sugerencias nuevas"}. Revísalas y acepta las que sirvan.`
                : "No hubo sugerencias nuevas: las ideas ya tenían una o el modelo no encontró coincidencias claras. Asígnalas a mano o agrega una nota a cada idea.")}
              {state.step === "done" && skipNote}
              {state.step === "error" && `No se pudo completar: ${state.message}`}
            </DialogDescription>
          </DialogHeader>

          {progress && (
            <div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress.pct}%` }} />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{progress.label}</p>
            </div>
          )}

          {state.step === "confirm" && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={close} className="flex-1">Cancelar</Button>
              <Button onClick={run} className="flex-1 font-semibold">Organizar</Button>
            </div>
          )}
          {(state.step === "done" || state.step === "error") && (
            <Button onClick={close} className="font-semibold">Entendido</Button>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
