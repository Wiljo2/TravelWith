import type { Idea } from "@/types";

// Showing an idea's video: its cover image and an in-app player.

// TikTok covers are signed URLs that expire after 1–3 days (`x-expires`).
// A fresh stored one is used as is; expired ones are renewed in the background
// (useFreshThumbnails) and meanwhile come through the app's cover route.
export function thumbExpired(url: string | undefined, marginMs = 0, now = Date.now()): boolean {
  if (!url) return true;
  const exp = url.match(/[?&]x-expires=(\d+)/)?.[1];
  return !!exp && Number(exp) * 1000 < now + marginMs;
}

export const thumbRoute = (roomCode: string, idea: Idea) => `/api/rooms/${roomCode}/thumb?url=${encodeURIComponent(idea.url)}`;

export function ideaThumbSrc(roomCode: string, idea: Idea): string | undefined {
  if (idea.thumbnail && !thumbExpired(idea.thumbnail)) return idea.thumbnail;
  return idea.platform === "tiktok" || idea.platform === "youtube" ? thumbRoute(roomCode, idea) : idea.thumbnail;
}

// "…/@user/video/7412345…" → "7412345…".
export const tiktokVideoId = (url: string) => url.match(/\/(?:video|photo)\/(\d+)/)?.[1];

export function youtubeVideoId(url: string): string | undefined {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1) || undefined;
    return u.searchParams.get("v") ?? u.pathname.match(/\/(?:shorts|embed|live)\/([\w-]+)/)?.[1];
  } catch {
    return undefined;
  }
}

const instagramCode = (url: string) => url.match(/instagram\.com\/(?:reel|reels|p|tv)\/([\w-]+)/)?.[1];

// The platform's own embed player, when the video can be played in the app.
// TikTok short links (vt./vm.tiktok.com) need the id resolved first (embedId).
export function ideaEmbedUrl(idea: Idea): string | undefined {
  if (idea.platform === "tiktok") {
    const id = idea.embedId ?? tiktokVideoId(idea.url);
    return id ? `https://www.tiktok.com/player/v1/${id}?description=1&music_info=1&rel=0` : undefined;
  }
  if (idea.platform === "youtube") {
    const id = youtubeVideoId(idea.url);
    return id ? `https://www.youtube.com/embed/${id}?playsinline=1` : undefined;
  }
  if (idea.platform === "instagram") {
    const code = instagramCode(idea.url);
    return code ? `https://www.instagram.com/reel/${code}/embed` : undefined;
  }
  return undefined;
}
