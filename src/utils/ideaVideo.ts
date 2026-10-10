import { classifyIdeaFields, normalizeText, type PlaceIndex } from "@/utils/ideas";
import type { Idea, IdeaSpot } from "@/types";

// Client view of the server's video analysis (server/video/analyze.ts).

export const MAX_VIDEO_ATTEMPTS = 3;
// Only short videos (reels, TikToks) are analyzed.
export const VIDEO_MAX_SECONDS = 90;

export const tooLongReason = (maxSeconds = VIDEO_MAX_SECONDS) => `Solo analizamos videos de hasta ${maxSeconds} segundos`;
// On when the server has GEMINI_API_KEY; only used to show "watching" on new ideas.
export const VIDEO_ANALYSIS_ON = process.env.NEXT_PUBLIC_VIDEO_ANALYSIS === "on";
const FIRST_RUN_MS = 5 * 60_000;

const due = (iso: string | undefined, now: number) => !!iso && Date.parse(iso) <= now;

// TikTok and Instagram videos are analyzed; YouTube isn't (its length is unknown).
export const isAnalyzablePlatform = (idea: Pick<Idea, "platform">) => idea.platform === "tiktok" || idea.platform === "instagram";

// A new TikTok or Instagram idea is analyzed right after it's saved, without a
// "pending" mark (the server writes once, at the end).
export function isAnalyzingVideo(idea: Idea, now = Date.now()): boolean {
  if (idea.video?.status === "pending") return !due(idea.video.retryAt, now);
  if (!VIDEO_ANALYSIS_ON || idea.video || idea.parentId) return false;
  if (!isAnalyzablePlatform(idea)) return false;
  return now - Date.parse(idea.createdAt) < FIRST_RUN_MS;
}

// A failed analysis whose retry time came (or one stuck pending): any member's
// app asks the server to run it again.
export function videoRetryDue(idea: Idea, now = Date.now()): boolean {
  const v = idea.video;
  if (!v || idea.parentId) return false;
  if (v.status === "pending") return due(v.retryAt, now);
  return v.status === "failed" && due(v.retryAt, now) && (v.attempts ?? 0) < MAX_VIDEO_ATTEMPTS;
}

// Ideas a video was split into hide the video itself: the board shows its spots.
export function hideSplitVideos(ideas: Idea[]): Idea[] {
  const split = new Set(ideas.filter(isAutoSpotIdea).map((i) => i.parentId));
  return split.size ? ideas.filter((i) => !split.has(i.id)) : ideas;
}

export function fmtVideoTime(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// Length of a local video file, read by the browser before uploading it;
// undefined when the browser can't tell.
export function videoFileSeconds(file: File): Promise<number | undefined> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    const done = (seconds?: number) => {
      URL.revokeObjectURL(url);
      resolve(seconds !== undefined && Number.isFinite(seconds) ? seconds : undefined);
    };
    video.preload = "metadata";
    video.onloadedmetadata = () => done(video.duration);
    video.onerror = () => done();
    video.src = url;
  });
}

// Spot ideas made by the analysis before spots were saved on demand ("<video>-s0"):
// their video shows as its spots. A spot the group saves later ("<video>-s-<name>") doesn't.
export const isAutoSpotIdea = (idea: Idea) => !!idea.parentId && /-s\d+$/.test(idea.id);

const slug = (name: string) =>
  normalizeText(name).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30) || "lugar";

// Saving a spot twice gives the same id, so it is never duplicated.
export const spotIdeaId = (parentId: string, spot: IdeaSpot) => `${parentId.slice(0, 64)}-s-${slug(spot.name)}`;

// A place a video recommends, saved by the group as an idea of its own: it can
// be placed, voted and planned like any idea, and opens its video.
export function spotIdea(parent: Idea, spot: IdeaSpot, index: PlaceIndex, addedBy?: string): Idea {
  const clean = <T extends object>(o: T): T => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
  const idea: Idea = clean({
    id: spotIdeaId(parent.id, spot),
    url: parent.url,
    platform: parent.platform,
    createdAt: new Date().toISOString(),
    title: spot.name,
    author: parent.author,
    thumbnail: parent.thumbnail,
    embedId: parent.embedId,
    addedBy: addedBy ?? parent.addedBy,
    status: "idea" as const,
    parentId: parent.id,
    spot: clean(spot),
  });
  const { place, cat } = classifyIdeaFields(idea, index);
  return place || cat ? { ...idea, suggestion: clean({ place, cat, source: "rules" as const }) } : idea;
}
