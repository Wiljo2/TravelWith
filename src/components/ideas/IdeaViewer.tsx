"use client";
import { useEffect, useState } from "react";
import { CalendarDays, Check, ExternalLink, Loader2, ThumbsUp, Trash2, Undo2, X } from "lucide-react";
import IdeaNote from "@/components/ideas/IdeaNote";
import IdeaThumb from "@/components/ideas/IdeaThumb";
import { IDEA_PLATFORMS } from "@/constants/ideaPlatforms";
import { IDEA_TYPES } from "@/constants/ideaTypes";
import { ideaEmbedUrl, tiktokVideoId } from "@/utils/ideaMedia";
import { cn } from "@/lib/utils";
import type { Idea } from "@/types";

const SELECT = "h-10 w-full min-w-0 cursor-pointer truncate rounded-xl border border-border bg-card px-2.5 text-[13px] text-foreground outline-none";
const ACTION = "flex h-10 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium";

interface IdeaViewerProps {
  idea: Idea;
  roomCode: string;
  places: string[];
  voter: string;
  loading: boolean;
  plan?: { when: string; reason?: string };   // where it fits the itinerary
  onUpdate: (patch: Partial<Idea>) => void;
  onSetPlace: (place: string | undefined) => void;
  onSetCat: (cat: string | undefined) => void;
  onVote: () => void;
  onRemove: () => void;
  onSetNote: (note: string) => void;
  onRetry: () => Promise<Idea | null>;
}

// One idea, opened: its video playing in the app (TikTok, YouTube, Instagram),
// where it fits the plan, and everything to edit about it.
export default function IdeaViewer({
  idea, roomCode, places, voter, loading, plan, onUpdate, onSetPlace, onSetCat, onVote, onRemove, onSetNote, onRetry,
}: IdeaViewerProps) {
  const p = IDEA_PLATFORMS[idea.platform];
  const embed = ideaEmbedUrl(idea);
  const discarded = idea.status === "discarded";
  const votes = idea.votes?.length ?? 0;
  const voted = idea.votes?.includes(voter) ?? false;
  const cat = idea.cat && IDEA_TYPES[idea.cat] ? idea.cat : undefined;
  const placeOptions = idea.place && !places.includes(idea.place) ? [...places, idea.place] : places;
  const s = idea.suggestion?.place || idea.suggestion?.cat ? idea.suggestion : undefined;
  const wide = idea.platform === "youtube" && !idea.url.includes("/shorts/");

  // A short TikTok link (vt.tiktok.com) hides the video id the player needs.
  const [resolving, setResolving] = useState(false);
  const needsId = idea.platform === "tiktok" && !idea.embedId && !tiktokVideoId(idea.url);
  useEffect(() => {
    if (!needsId) return;
    let cancelled = false;
    setResolving(true);
    fetch(`/api/rooms/${roomCode}/thumb?format=id&url=${encodeURIComponent(idea.url)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { embedId?: string } | null) => { if (!cancelled && d?.embedId) onUpdate({ embedId: d.embedId }); })
      .catch(() => undefined)
      .finally(() => { if (!cancelled) setResolving(false); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- once per idea
  }, [idea.id, needsId]);

  return (
    <div className="flex flex-col gap-4">
      <div className={cn("relative mx-auto overflow-hidden rounded-2xl bg-black", wide ? "aspect-video w-full" : "aspect-[9/16] h-[min(58dvh,560px)]")}>
        {embed ? (
          <iframe
            src={embed}
            title={idea.title || "Video"}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            className="absolute inset-0 size-full border-0"
          />
        ) : (
          <>
            <IdeaThumb idea={idea} roomCode={roomCode} className="absolute inset-0 size-full" />
            <a
              href={idea.url}
              target="_blank"
              rel="noreferrer"
              className="absolute inset-0 flex items-center justify-center bg-black/30 text-sm font-semibold text-white"
            >
              {resolving ? <Loader2 className="size-6 animate-spin" /> : <>Ver en {p.label}</>}
            </a>
          </>
        )}
      </div>

      <div>
        <p className="text-[15px] font-semibold leading-snug">{idea.note || idea.title || p.label}</p>
        {idea.note && idea.title && <p className="mt-1 line-clamp-4 text-[13px] leading-relaxed text-secondary-foreground">{idea.title}</p>}
        <p className="mt-1 text-xs text-muted-foreground">
          {idea.author && <>@{idea.author.replace(/^@/, "")} · </>}
          {idea.addedBy ? `compartida por ${idea.addedBy}` : p.label}
        </p>
      </div>

      {plan && (
        <div className="flex gap-2.5 rounded-xl bg-accent px-3 py-2.5 text-[13px] text-accent-foreground">
          <CalendarDays className="mt-0.5 size-4 shrink-0" />
          <span>
            <span className="font-semibold">{plan.when}</span>
            {plan.reason && <span className="block text-xs">{plan.reason}</span>}
          </span>
        </div>
      )}

      {s && !discarded && (
        <div className="flex items-center gap-2 rounded-xl bg-secondary px-3 py-2 text-[13px]">
          <span className="min-w-0 flex-1">¿{[s.place && `📍 ${s.place}`, s.cat && IDEA_TYPES[s.cat] && `${IDEA_TYPES[s.cat].icon} ${IDEA_TYPES[s.cat].label}`].filter(Boolean).join(" · ")}?</span>
          <button
            onClick={() => onUpdate({ place: s.place ?? idea.place, cat: s.cat ?? idea.cat, suggestion: undefined })}
            className="flex h-8 cursor-pointer items-center gap-1 rounded-lg bg-primary px-2.5 font-semibold text-primary-foreground"
          >
            <Check className="size-3.5" /> Sí
          </button>
          <button onClick={() => onUpdate({ suggestion: undefined })} aria-label="Descartar sugerencia" className="flex size-8 cursor-pointer items-center justify-center rounded-lg hover:bg-card">
            <X className="size-4" />
          </button>
        </div>
      )}

      {!discarded && (
        <div className="grid grid-cols-2 gap-2">
          <select value={idea.place ?? ""} onChange={(e) => onSetPlace(e.target.value || undefined)} aria-label="Lugar" className={SELECT}>
            <option value="">📍 Sin lugar</option>
            {placeOptions.map((pl) => <option key={pl} value={pl}>{pl}</option>)}
          </select>
          <select value={cat ?? ""} onChange={(e) => onSetCat(e.target.value || undefined)} aria-label="Tipo" className={SELECT}>
            <option value="">Sin tipo</option>
            {Object.entries(IDEA_TYPES).map(([k, t]) => <option key={k} value={k}>{t.icon} {t.label}</option>)}
          </select>
        </div>
      )}

      {!discarded && !loading && <IdeaNote key={idea.note ?? ""} idea={idea} onSetNote={onSetNote} onRetry={onRetry} />}

      {idea.transcript && (
        <details className="group rounded-xl bg-secondary px-3 py-2.5 text-xs">
          <summary className="cursor-pointer list-none font-medium text-secondary-foreground [&::-webkit-details-marker]:hidden">
            🎙️ Lo que dice el video <span className="text-muted-foreground group-open:hidden">· ver</span>
          </summary>
          <p className="mt-1.5 max-h-48 overflow-y-auto leading-relaxed text-secondary-foreground">{idea.transcript}</p>
        </details>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        <button
          onClick={onVote}
          aria-pressed={voted}
          className={cn(ACTION, voted ? "bg-primary/15 text-emerald-800" : "bg-secondary text-secondary-foreground")}
        >
          <ThumbsUp className="size-4" /> {voted ? "Te gusta" : "Me gusta"}{votes > 0 && ` · ${votes}`}
        </button>
        <a href={idea.url} target="_blank" rel="noreferrer" className={cn(ACTION, "bg-secondary text-secondary-foreground")}>
          <ExternalLink className="size-4" /> Abrir en {p.label}
        </a>
        <button
          onClick={() => onUpdate({ status: discarded ? "idea" : "discarded" })}
          className={cn(ACTION, "ml-auto text-muted-foreground hover:bg-secondary")}
        >
          {discarded ? <><Undo2 className="size-4" /> Restaurar</> : <><X className="size-4" /> Descartar</>}
        </button>
        {discarded && (
          <button onClick={onRemove} aria-label="Eliminar" className="flex size-10 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
            <Trash2 className="size-4" />
          </button>
        )}
      </div>
    </div>
  );
}
