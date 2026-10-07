"use client";
import { Loader2, MapPin, Play, ThumbsUp } from "lucide-react";
import IdeaThumb from "@/components/ideas/IdeaThumb";
import { IDEA_PLATFORMS } from "@/constants/ideaPlatforms";
import { IDEA_TYPES } from "@/constants/ideaTypes";
import { linkLabel } from "@/utils/linkify";
import { cn } from "@/lib/utils";
import type { Idea } from "@/types";

// An idea as a vertical cover card (like a feed of reels): the cover fills it,
// the caption sits on a dark fade at the bottom. Tapping opens the viewer.
export default function IdeaCard({ idea, roomCode, loading, spot, onOpen, className }: {
  idea: Idea;
  roomCode: string;
  loading: boolean;
  spot?: string;     // the exact place, when the card sits under a wider zone
  onOpen: () => void;
  className?: string;
}) {
  const t = idea.cat ? IDEA_TYPES[idea.cat] : undefined;
  const votes = idea.votes?.length ?? 0;
  const heading = idea.note || idea.title || linkLabel(idea.url);

  return (
    <button
      onClick={onOpen}
      className={cn(
        "relative aspect-[9/16] shrink-0 cursor-pointer snap-start overflow-hidden rounded-2xl bg-secondary text-left ring-1 ring-border transition-transform active:scale-[.98]",
        idea.status === "discarded" && "opacity-60",
        className,
      )}
    >
      <IdeaThumb idea={idea} roomCode={roomCode} className="absolute inset-0 size-full" />
      <span className={cn("absolute left-2 top-2 rounded-md px-1.5 py-0.5 text-[10px] font-bold", IDEA_PLATFORMS[idea.platform].className)}>
        {IDEA_PLATFORMS[idea.platform].short}
      </span>
      <span className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur">
        {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5 fill-current" />}
      </span>
      <span className="absolute inset-x-0 bottom-0 flex flex-col gap-1 bg-linear-to-t from-black/85 via-black/45 to-transparent p-2.5 pt-10">
        <span className="line-clamp-2 text-[12.5px] font-semibold leading-snug text-white">
          {loading ? "Leyendo el video…" : heading}
        </span>
        <span className="flex min-w-0 items-center gap-2 text-[11px] text-white/85">
          {t && <span className="shrink-0">{spot ? t.icon : `${t.icon} ${t.label}`}</span>}
          {spot && <span className="flex min-w-0 items-center gap-0.5"><MapPin className="size-3 shrink-0" /><span className="truncate">{spot}</span></span>}
          {votes > 0 && <span className="flex items-center gap-0.5"><ThumbsUp className="size-3" />{votes}</span>}
        </span>
      </span>
    </button>
  );
}
