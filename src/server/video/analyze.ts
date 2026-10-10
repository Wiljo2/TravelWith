import { after } from "next/server";
import { runOp } from "@/server/ops";
import type { OpContext } from "@/server/ops/types";
import { RowConflictError } from "@/server/repo/errors";
import { ideasRepo } from "@/server/repo/ideas";
import { getTrip } from "@/server/repo/trip";
import { VideoTooLargeError } from "@/server/tiktok";
import { childIdeas, doneVideo, withPostMeta, withVideo, type VideoAnalysis } from "@/server/video/analysis";
import { videoConfig } from "@/server/video/config";
import { GeminiBusyError, GeminiError, watchVideo, type GeminiUsage } from "@/server/video/gemini";
import { deleteUpload, resolveVideo, uploadPrefix, type PostMeta, type VideoSource } from "@/server/video/sources";
import { recordVideoUsage, videosAnalyzedToday } from "@/server/video/usage";
import { MAX_VIDEO_ATTEMPTS } from "@/utils/ideaVideo";
import { placeIndex, type PlaceIndex } from "@/utils/ideas";
import { tripPlaces } from "@/utils/places";
import { rowToIdea, type Row } from "@/utils/tripRows";
import type { Idea, IdeaVideo } from "@/types";

// The video of an idea, watched by Gemini after the idea is saved. Runs after
// the response (next/server `after`), so adding an idea stays instant. The
// result is written once, at the end, merged onto the latest version of the
// idea: members' edits made meanwhile are kept. Every member sees it arrive
// over Broadcast.

export const MAX_ATTEMPTS = MAX_VIDEO_ATTEMPTS;
const RETRY_MINUTES = [10, 60];
const WRITE_TRIES = 3;
const PENDING_MINUTES = 15;
// Vercel stops the function at maxDuration (300 s on every plan); the analysis
// leaves room to write the result.
export const VIDEO_MAX_DURATION = 300;
const BUDGET_MS = (VIDEO_MAX_DURATION - 30) * 1000;

export function scheduleVideoAnalysis(ctx: OpContext, ideaId: string) {
  if (!videoConfig().enabled) return;
  after(() => analyzeIdeaVideo(ctx, ideaId).catch((e) => console.error("[video] analysis failed", ideaId, e)));
}

type Outcome =
  | { kind: "done"; analysis: VideoAnalysis; model: string; attempts: number; meta?: PostMeta }
  | { kind: "status"; video: IdeaVideo; meta?: PostMeta };

export interface AnalyzeOptions {
  manual?: boolean;      // a member asked (retry or upload); otherwise automatic
  first?: boolean;       // right after the idea was created
  uploadPath?: string;   // a file the member uploaded (deleted afterwards)
}

export type AnalyzeResult = "done" | "failed" | "needsFile" | "skipped" | "ignored";

const due = (iso: string | undefined) => !!iso && Date.parse(iso) <= Date.now();

// Never analyzed, or a member asked (manual), or a failed analysis whose retry
// time came. A pending one is left alone unless it got stuck.
export function shouldAnalyze(idea: Idea, manual: boolean): boolean {
  const v = idea.video;
  if (idea.parentId || v?.status === "done") return false;
  if (v?.status === "pending") return due(v.retryAt);
  if (!v || manual) return true;
  return v.status === "failed" && due(v.retryAt) && (v.attempts ?? 0) < MAX_ATTEMPTS;
}

// The first run (right after the idea was created) claims nothing: no one else
// knows the idea yet, and a write now would race the client's caption fetch.
export async function analyzeIdeaVideo(ctx: OpContext, ideaId: string, opts: AnalyzeOptions = {}): Promise<AnalyzeResult> {
  const { manual = false, first = true, uploadPath } = opts;
  try {
    return await analyze(ctx, ideaId, manual, first, uploadPath);
  } finally {
    if (uploadPath?.startsWith(uploadPrefix(ctx.code, ideaId))) await deleteUpload(uploadPath);
  }
}

async function analyze(ctx: OpContext, ideaId: string, manual: boolean, first: boolean, uploadPath?: string): Promise<AnalyzeResult> {
  const cfg = videoConfig();
  if (!cfg.enabled) return "ignored";
  const row = await ideasRepo.get(ctx.code, ideaId);
  if (!row) return "ignored";
  const idea = rowToIdea(row as unknown as Row);
  if (!shouldAnalyze(idea, manual)) return "ignored";
  const previousAttempts = idea.video?.attempts ?? 0;
  if (!first && !(await claim(ctx, idea, row.version))) return "ignored";

  const started = Date.now();
  let source: VideoSource = "other";
  let seconds: number | undefined;
  let bytes: number | undefined;
  let usage: GeminiUsage | undefined;
  let model: string | undefined;
  let attempts = 0;
  let providerCalls = 0;
  let meta: PostMeta | undefined;
  let outcome: Outcome;
  let index: PlaceIndex | null = null;

  try {
    if ((await videosAnalyzedToday(ctx.userId)) >= cfg.dailyLimit) {
      outcome = { kind: "status", video: { status: "skipped", reason: "Llegaste al límite diario de videos analizados" } };
    } else {
      const resolved = await resolveVideo(idea, ctx.code, uploadPath);
      source = resolved.source;
      providerCalls = resolved.providerCalls ?? 0;
      if (resolved.ok) meta = resolved.meta;
      if (!resolved.ok) {
        outcome = { kind: "status", video: { status: resolved.status, reason: resolved.reason } };
      } else if (resolved.seconds && resolved.seconds > cfg.maxSeconds) {
        outcome = { kind: "status", video: { status: "skipped", reason: `El video dura más de ${Math.round(cfg.maxSeconds / 60)} minutos` } };
      } else {
        ({ seconds, bytes } = resolved);
        const trip = await getTrip(ctx.code);
        const days = trip?.payload.days ?? [];
        const places = tripPlaces(trip?.payload.trip?.destination, days, trip?.payload.ideaPlaces);
        index = placeIndex(places, days);
        const result = await watchVideo(resolved.input, places.map((p) => p.name), started + BUDGET_MS);
        ({ usage, model, attempts } = result);
        outcome = { kind: "done", analysis: result.analysis, model: result.model, attempts: result.attempts };
      }
    }
  } catch (e) {
    const retryable = !(e instanceof VideoTooLargeError) && !(e instanceof GeminiError);
    if (e instanceof GeminiBusyError) attempts = e.attempts;
    outcome = { kind: "status", video: failedVideo(e, previousAttempts + 1, retryable) };
  }
  outcome.meta = meta;

  await writeOutcome(ctx, ideaId, outcome, index);
  await recordVideoUsage({
    userId: ctx.userId,
    roomCode: ctx.code,
    ideaId,
    source,
    ok: outcome.kind === "done",
    reason: outcome.kind === "status" ? outcome.video.reason : undefined,
    model,
    seconds,
    bytes,
    usage,
    providerCalls,
    attempts,
    wallMs: Date.now() - started,
  });
  return outcome.kind === "done" ? "done" : (outcome.video.status as AnalyzeResult);
}

// Marks the idea pending (guarded by its version): when two members retry at
// once, only one analysis runs.
async function claim(ctx: OpContext, idea: Idea, version: number): Promise<boolean> {
  const retryAt = new Date(Date.now() + PENDING_MINUTES * 60_000).toISOString();
  const video: IdeaVideo = { status: "pending", attempts: idea.video?.attempts, retryAt };
  try {
    await runOp("idea.applyVideo", ctx, { args: { id: idea.id, idea: strip({ ...idea, video }), children: [] }, expectedVersion: version });
    return true;
  } catch (e) {
    if (e instanceof RowConflictError) return false;
    throw e;
  }
}

function failedVideo(e: unknown, attempts: number, retryable: boolean): IdeaVideo {
  if (e instanceof VideoTooLargeError) return { status: "skipped", reason: "El video es demasiado pesado" };
  console.error("[video]", e);
  const minutes = RETRY_MINUTES[attempts - 1];
  const retryAt = retryable && minutes ? new Date(Date.now() + minutes * 60_000).toISOString() : undefined;
  return {
    status: "failed",
    reason: e instanceof GeminiBusyError ? "El servicio de video está saturado" : "No se pudo analizar el video",
    attempts,
    ...(retryAt ? { retryAt } : {}),
  };
}

// Merges onto the latest row and writes with its version; a member's edit in
// between makes the write conflict, so it reads again and retries.
async function writeOutcome(ctx: OpContext, ideaId: string, outcome: Outcome, index: PlaceIndex | null) {
  for (let i = 0; i < WRITE_TRIES; i++) {
    const row = await ideasRepo.get(ctx.code, ideaId);
    if (!row) return;
    const current = withPostMeta(rowToIdea(row as unknown as Row), outcome.meta);
    const video = outcome.kind === "done"
      ? doneVideo(outcome.analysis, outcome.model, (current.video?.attempts ?? 0) + 1)
      : outcome.video;
    const next = withVideo(current, video, index);
    const children = outcome.kind === "done" && index ? childIdeas(current, outcome.analysis, index) : [];
    try {
      await runOp(
        "idea.applyVideo",
        ctx,
        { args: { id: ideaId, idea: strip(next), children: children.map((c) => ({ id: c.id, idea: strip(c) })) }, expectedVersion: row.version },
      );
      return;
    } catch (e) {
      if (!(e instanceof RowConflictError) || i === WRITE_TRIES - 1) throw e;
    }
  }
}

const strip = ({ id: _id, version: _version, ...rest }: Idea) => rest;
