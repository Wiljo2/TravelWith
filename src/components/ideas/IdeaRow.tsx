"use client";
import { useState } from "react";
import { Check, ChevronDown, ExternalLink, Loader2, ThumbsUp, Trash2, Undo2, X } from "lucide-react";
import { IDEA_TYPES } from "@/constants/ideaTypes";
import { linkLabel } from "@/utils/linkify";
import IdeaNote from "@/components/ideas/IdeaNote";
import { cn } from "@/lib/utils";
import type { Idea, IdeaPlatform } from "@/types";

const PLATFORM: Record<IdeaPlatform, { label: string; short: string; className: string }> = {
  tiktok:    { label: "TikTok",    short: "TT", className: "bg-neutral-900 text-white" },
  instagram: { label: "Instagram", short: "IG", className: "bg-linear-to-br from-amber-400 via-pink-500 to-purple-600 text-white" },
  youtube:   { label: "YouTube",   short: "YT", className: "bg-red-600 text-white" },
  other:     { label: "Enlace",    short: "🔗", className: "bg-muted text-muted-foreground" },
};

const SELECT = "h-9 w-full min-w-0 cursor-pointer truncate rounded-lg border border-border bg-card px-2 text-xs text-foreground outline-none";

export function typeLabel(key?: string) {
  const t = key ? IDEA_TYPES[key] : undefined;
  return t ? `${t.icon} ${t.label}` : undefined;
}

interface IdeaRowProps {
  idea: Idea;
  places: string[];
  voter: string;
  loading: boolean;       // caption still being fetched
  showPlace: boolean;     // false inside a place group (already in its header)
  onUpdate: (patch: Partial<Idea>) => void;
  onVote: () => void;
  onRemove: () => void;
  onSetNote: (note: string) => void;
  onRetry?: () => Promise<Idea | null>;
}

// One idea as a compact row; editing controls stay folded until it's opened.
export default function IdeaRow({
  idea, places, voter, loading, showPlace, onUpdate, onVote, onRemove, onSetNote, onRetry,
}: IdeaRowProps) {
  const [open, setOpen] = useState(false);
  // TikTok covers are signed URLs that expire after a few days.
  const [thumbFailed, setThumbFailed] = useState(false);
  const p = PLATFORM[idea.platform];
  const discarded = idea.status === "discarded";
  const votes = idea.votes?.length ?? 0;
  const voted = idea.votes?.includes(voter) ?? false;
  const cat = idea.cat && IDEA_TYPES[idea.cat] ? idea.cat : undefined;
  // Legacy suggestions (day-based) have neither field: ignore them.
  const s = !loading && (idea.suggestion?.place || idea.suggestion?.cat) ? idea.suggestion : undefined;
  const missingText = !loading && !idea.title && !idea.note;
  const placeOptions = idea.place && !places.includes(idea.place) ? [...places, idea.place] : places;
  const meta = [
    idea.transcript ? `${p.label} 🎙️` : p.label,
    showPlace && idea.place && `📍 ${idea.place}`,
    typeLabel(cat),
  ].filter(Boolean).join(" · ");

  return (
    <li className={cn("py-2.5", discarded && "opacity-60")}>
      <div className="flex items-center gap-3">
        <a href={idea.url} target="_blank" rel="noreferrer" className="shrink-0" aria-label="Abrir el video">
          {idea.thumbnail && !thumbFailed ? (
            // eslint-disable-next-line @next/next/no-img-element -- remote CDN thumbnails, not optimizable
            <img src={idea.thumbnail} alt="" onError={() => setThumbFailed(true)} className="h-14 w-11 rounded-lg object-cover" />
          ) : (
            <span className={cn("flex h-14 w-11 items-center justify-center rounded-lg text-xs font-bold", p.className)}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : p.short}
            </span>
          )}
        </a>

        <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="min-w-0 flex-1 cursor-pointer text-left">
          {loading ? (
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 shrink-0 animate-spin" />
              Leyendo {p.label}…
            </span>
          ) : (
            <span className="line-clamp-1 text-sm font-medium text-foreground">{idea.title || idea.note || linkLabel(idea.url)}</span>
          )}
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
            {loading ? "Leyendo el texto y lo que dice el video para clasificarlo" : meta}
            {missingText && <span className="text-amber-700"> · falta una nota</span>}
          </span>
        </button>

        <button
          onClick={onVote}
          aria-pressed={voted}
          aria-label="Me gusta"
          className={cn(
            "flex h-8 shrink-0 cursor-pointer items-center gap-1 rounded-full px-2 text-xs font-medium",
            voted ? "bg-primary/15 text-emerald-800" : "text-muted-foreground hover:bg-secondary hover:text-foreground",
          )}
        >
          <ThumbsUp className="size-3.5" />{votes > 0 && votes}
        </button>
        <button
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Cerrar" : "Ver detalles"}
          className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:bg-secondary"
        >
          <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
        </button>
      </div>

      {s && !discarded && (
        <div className="ml-14 mt-2 flex items-center gap-2 rounded-lg bg-accent px-2.5 py-1.5 text-xs text-accent-foreground">
          <span className="line-clamp-2 min-w-0 flex-1">
            {s.source === "rules" ? "🔎" : "✨"} ¿{[s.place && `📍 ${s.place}`, typeLabel(s.cat)].filter(Boolean).join(" · ")}?
          </span>
          <button
            onClick={() => onUpdate({ place: s.place ?? idea.place, cat: s.cat ?? idea.cat, suggestion: undefined })}
            aria-label="Aceptar sugerencia"
            className="flex h-7 shrink-0 cursor-pointer items-center gap-1 rounded-md bg-primary px-2 font-semibold text-primary-foreground"
          >
            <Check className="size-3.5" /> Sí
          </button>
          <button onClick={() => onUpdate({ suggestion: undefined })} aria-label="Descartar sugerencia" className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md hover:bg-card">
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {open && !loading && (
        <div className="ml-14 mt-1">
          {!discarded && <IdeaNote key={idea.note ?? ""} idea={idea} onSetNote={onSetNote} onRetry={onRetry} />}
          {idea.title && idea.title.length > 60 && (
            <p className="mt-2 line-clamp-4 text-xs leading-relaxed text-secondary-foreground">{idea.title}</p>
          )}
          {idea.transcript && (
            <details className="group mt-2 rounded-lg bg-secondary px-2.5 py-2 text-xs">
              <summary className="cursor-pointer list-none font-medium text-secondary-foreground [&::-webkit-details-marker]:hidden">
                🎙️ Lo que dice el video <span className="text-muted-foreground group-open:hidden">· ver</span>
              </summary>
              <p className="mt-1.5 max-h-40 overflow-y-auto leading-relaxed text-secondary-foreground">{idea.transcript}</p>
            </details>
          )}
          {!discarded && (
            <div className="mt-2.5 grid grid-cols-2 gap-1.5">
              <select value={idea.place ?? ""} onChange={(e) => onUpdate({ place: e.target.value || undefined })} aria-label="Lugar" className={SELECT}>
                <option value="">📍 Sin lugar</option>
                {placeOptions.map((pl) => <option key={pl} value={pl}>{pl}</option>)}
              </select>
              <select value={cat ?? ""} onChange={(e) => onUpdate({ cat: e.target.value || undefined })} aria-label="Tipo" className={SELECT}>
                <option value="">Sin tipo</option>
                {Object.entries(IDEA_TYPES).map(([k, t]) => <option key={k} value={k}>{t.icon} {t.label}</option>)}
              </select>
            </div>
          )}
          <div className="mt-2 flex items-center gap-1 text-xs">
            <span className="min-w-0 flex-1 truncate text-muted-foreground">
              {idea.author && <>@{idea.author.replace(/^@/, "")} · </>}
              {idea.addedBy ? `por ${idea.addedBy}` : p.label}
            </span>
            <a href={idea.url} target="_blank" rel="noreferrer" className="flex h-8 items-center gap-1 rounded-full px-2.5 font-medium text-secondary-foreground hover:bg-secondary">
              <ExternalLink className="size-3.5" /> Abrir
            </a>
            <button
              onClick={() => onUpdate({ status: discarded ? "idea" : "discarded" })}
              className="flex h-8 cursor-pointer items-center gap-1 rounded-full px-2.5 font-medium text-secondary-foreground hover:bg-secondary"
            >
              {discarded ? <><Undo2 className="size-3.5" /> Restaurar</> : <><X className="size-3.5" /> Descartar</>}
            </button>
            {discarded && (
              <button onClick={onRemove} aria-label="Eliminar" className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                <Trash2 className="size-4" />
              </button>
            )}
          </div>
        </div>
      )}
    </li>
  );
}
