import { createServerClient } from "@/lib/supabase-server";
import { fetchTikTokVideo, resolveTikTokUrl, VideoTooLongError } from "@/server/tiktok";
import type { VideoInput } from "@/server/video/gemini";
import { fetchInstagramPost, instagramProviderEnabled } from "@/server/video/instagram";
import { isHostOf } from "@/utils/ideas";
import { tooLongReason } from "@/utils/ideaVideo";
import type { Idea, IdeaVideoSkip } from "@/types";

// Where the video of an idea comes from. TikTok: downloaded from its page;
// Instagram: through the scraping provider; either: a file a member uploaded
// (see upload-url route). Only short videos are analyzed, and YouTube isn't:
// its length can't be known before Gemini watches the whole video.

export const VIDEO_MAX_BYTES = 60 * 1024 * 1024;
export const UPLOAD_MAX_BYTES = 100 * 1024 * 1024;
export const UPLOAD_BUCKET = "idea-videos";

export type VideoSource = "tiktok" | "instagram" | "youtube" | "upload" | "other";

// Post data found while getting the video; fills what the idea lacks.
export interface PostMeta {
  title?: string;
  author?: string;
  thumbnail?: string;
}

export type ResolvedVideo =
  | { ok: true; input: VideoInput; source: VideoSource; seconds?: number; bytes?: number; meta?: PostMeta; providerCalls?: number }
  | { ok: false; status: "needsFile" | "skipped"; reason: string; source: VideoSource; providerCalls?: number; skip?: IdeaVideoSkip };

const NEEDS_FILE = "No se pudo descargar el video; súbelo para analizarlo";
export const YOUTUBE_REASON = "Por ahora no analizamos videos de YouTube";

// Uploads live under <room>/<idea>/ so a member can't point at another trip's file.
export const uploadPrefix = (code: string, ideaId: string) => `${code}/${ideaId}/`;

const tooLong = (source: VideoSource, maxSeconds: number, providerCalls?: number): ResolvedVideo =>
  ({ ok: false, status: "skipped", reason: tooLongReason(maxSeconds), skip: "tooLong", source, providerCalls });

export async function resolveVideo(idea: Idea, code: string, maxSeconds: number, uploadPath?: string): Promise<ResolvedVideo> {
  if (uploadPath) return fromUpload(code, idea.id, uploadPath);

  let url: URL;
  try {
    url = new URL(idea.url);
  } catch {
    return { ok: false, status: "skipped", reason: "Enlace inválido", source: "other" };
  }

  if (idea.platform === "youtube") {
    return { ok: false, status: "skipped", reason: YOUTUBE_REASON, skip: "platform", source: "youtube" };
  }

  if (idea.platform === "tiktok" && isHostOf(url.hostname, "tiktok.com")) {
    let video;
    try {
      video = await fetchTikTokVideo(await resolveTikTokUrl(url), VIDEO_MAX_BYTES, maxSeconds);
    } catch (e) {
      if (e instanceof VideoTooLongError) return tooLong("tiktok", maxSeconds);
      throw e;
    }
    if (!video) return { ok: false, status: "needsFile", reason: NEEDS_FILE, source: "tiktok" };
    const { data, mime, seconds, ...meta } = video;
    return { ok: true, input: { kind: "bytes", data, mime }, source: "tiktok", seconds, bytes: data.byteLength, meta };
  }

  if (idea.platform === "instagram") {
    if (!instagramProviderEnabled()) {
      return { ok: false, status: "needsFile", reason: "Instagram no deja descargar el video; súbelo para analizarlo", source: "instagram" };
    }
    let long = false;
    const post = await fetchInstagramPost(idea.url, VIDEO_MAX_BYTES, maxSeconds).catch((e) => {
      if (e instanceof VideoTooLongError) long = true;
      else console.error("[video] instagram", e);
      return null;
    });
    if (long) return tooLong("instagram", maxSeconds, 1);
    if (!post) return { ok: false, status: "needsFile", reason: NEEDS_FILE, source: "instagram", providerCalls: 1 };
    const { data, mime, seconds, ...meta } = post;
    return { ok: true, input: { kind: "bytes", data, mime }, source: "instagram", seconds, bytes: data.byteLength, meta, providerCalls: 1 };
  }

  return { ok: false, status: "skipped", reason: "Solo se analizan videos de TikTok e Instagram", skip: "platform", source: "other" };
}

async function fromUpload(code: string, ideaId: string, path: string): Promise<ResolvedVideo> {
  if (!path.startsWith(uploadPrefix(code, ideaId)) || path.includes("..")) {
    return { ok: false, status: "skipped", reason: "Archivo inválido", source: "upload" };
  }
  const { data, error } = await createServerClient().storage.from(UPLOAD_BUCKET).download(path);
  if (error || !data) return { ok: false, status: "needsFile", reason: "No se encontró el video subido", source: "upload" };
  if (data.size > UPLOAD_MAX_BYTES) return { ok: false, status: "skipped", reason: "El video es demasiado pesado", source: "upload" };
  const bytes = new Uint8Array(await data.arrayBuffer());
  return { ok: true, input: { kind: "bytes", data: bytes, mime: data.type || "video/mp4" }, source: "upload", bytes: bytes.byteLength };
}

export async function deleteUpload(path: string) {
  const { error } = await createServerClient().storage.from(UPLOAD_BUCKET).remove([path]);
  if (error) console.error("[video] failed to delete upload", path, error);
}
