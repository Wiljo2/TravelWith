"use client";
import { useRef, useState } from "react";
import { Loader2, RotateCw, Sparkles, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IDEA_TYPES } from "@/constants/ideaTypes";
import { fmtVideoTime, isAnalyzingVideo } from "@/utils/ideaVideo";
import type { Idea, IdeaSpot } from "@/types";

// What the video shows, as the server's analysis saw it: for a spot idea, its
// spot first; then the summary of the whole video and every spot in it.
export default function IdeaVideoPanel({ idea, parent, onRetry, onUpload }: {
  idea: Idea;
  parent?: Idea;           // the video this spot idea came from
  onRetry: () => Promise<boolean>;
  onUpload: (file: File) => Promise<string | null>;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const source = parent ?? idea;
  const video = source.video;
  // After "Reintentar", until the server's answer changes the analysis.
  const key = `${video?.status}|${video?.attempts}|${video?.retryAt}`;
  const [askedAt, setAskedAt] = useState<string | null>(null);
  const analyzing = isAnalyzingVideo(source) || askedAt === key;

  async function upload(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    const error = await onUpload(file);
    setUploading(false);
    if (error) setUploadError(error);
    else setAskedAt(key);
  }

  if (analyzing || uploading) {
    return (
      <p className="flex items-center gap-2 rounded-xl bg-secondary px-3 py-2.5 text-[13px] text-secondary-foreground">
        <Loader2 className="size-4 animate-spin" /> {uploading ? "Subiendo el video…" : "Viendo el video… (tarda un minuto)"}
      </p>
    );
  }
  if (!video) return null;

  if (video.status !== "done") {
    const canRetry = video.status !== "pending";
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-xl bg-secondary px-3 py-2 text-[13px] text-secondary-foreground">
        <span className="min-w-0 flex-1">{uploadError ?? video.reason ?? "No se pudo ver el video"}</span>
        {video.status === "needsFile" && (
          <>
            <input ref={fileInput} type="file" accept="video/*" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
            <Button size="sm" className="h-8 gap-1 rounded-lg" onClick={() => fileInput.current?.click()}>
              <Upload className="size-3.5" /> Subir video
            </Button>
          </>
        )}
        {canRetry && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1 rounded-lg"
            onClick={async () => { if (await onRetry()) setAskedAt(key); }}
          >
            <RotateCw className="size-3.5" /> Reintentar
          </Button>
        )}
      </div>
    );
  }

  const spots = video.spots ?? [];
  return (
    <div className="flex flex-col gap-2.5 rounded-xl bg-secondary px-3 py-2.5 text-[13px]">
      {idea.spot && <SpotLine spot={idea.spot} strong />}
      <details className="group" open={!idea.spot}>
        <summary className="flex cursor-pointer list-none items-center gap-1.5 font-medium text-secondary-foreground [&::-webkit-details-marker]:hidden">
          <Sparkles className="size-3.5 text-amber-500" />
          {video.relevant === false ? "Este video no parece ser del viaje" : "Lo que muestra el video"}
          {idea.spot && <span className="text-muted-foreground group-open:hidden">· ver</span>}
        </summary>
        <p className="mt-1.5 leading-relaxed text-secondary-foreground">{video.summary}</p>
        {spots.length > 0 && (
          <ul className="mt-2 flex flex-col gap-1.5">
            {spots.map((s) => <li key={s.name}><SpotLine spot={s} /></li>)}
          </ul>
        )}
      </details>
      <p className="text-[11px] text-muted-foreground">Analizado con IA de Google a partir del video.</p>
    </div>
  );
}

function SpotLine({ spot, strong }: { spot: IdeaSpot; strong?: boolean }) {
  const t = spot.cat ? IDEA_TYPES[spot.cat] : undefined;
  const meta = [spot.city, spot.price, spot.at !== undefined && `▶ ${fmtVideoTime(spot.at)}`].filter(Boolean).join(" · ");
  return (
    <div className="leading-snug">
      <p className={strong ? "font-semibold text-foreground" : "font-medium text-foreground"}>
        {t && <span className="mr-1">{t.icon}</span>}{spot.name}
        {meta && <span className="ml-1.5 text-xs font-normal text-muted-foreground">{meta}</span>}
      </p>
      {spot.tip && <p className="text-xs text-secondary-foreground">{spot.tip}</p>}
    </div>
  );
}
