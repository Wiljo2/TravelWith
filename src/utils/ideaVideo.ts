import type { Idea } from "@/types";

// Client view of the server's video analysis (server/video/analyze.ts).

export const MAX_VIDEO_ATTEMPTS = 3;
// On when the server has GEMINI_API_KEY; only used to show "watching" on new ideas.
export const VIDEO_ANALYSIS_ON = process.env.NEXT_PUBLIC_VIDEO_ANALYSIS === "on";
const FIRST_RUN_MS = 5 * 60_000;

const due = (iso: string | undefined, now: number) => !!iso && Date.parse(iso) <= now;

// A new TikTok, Instagram or YouTube idea is analyzed right after it's saved, without a
// "pending" mark (the server writes once, at the end).
export function isAnalyzingVideo(idea: Idea, now = Date.now()): boolean {
  if (idea.video?.status === "pending") return !due(idea.video.retryAt, now);
  if (!VIDEO_ANALYSIS_ON || idea.video || idea.parentId) return false;
  if (idea.platform === "other") return false;
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
  const split = new Set(ideas.map((i) => i.parentId).filter(Boolean));
  return split.size ? ideas.filter((i) => !split.has(i.id)) : ideas;
}

export function fmtVideoTime(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
