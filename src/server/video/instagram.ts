import { readCapped } from "@/server/tiktok";
import { isHostOf } from "@/utils/ideas";

// Instagram blocks anonymous requests from datacenter IPs, so a scraping
// provider (an Apify actor) reads the post: caption, author, cover and the
// video's signed CDN URL. The MP4 itself is then downloaded from Instagram's
// CDN, which allows it. Without INSTAGRAM_PROVIDER_TOKEN the provider is off.

const DEFAULT_ACTOR = "apify~instagram-scraper";
const CDN_DOMAINS = ["cdninstagram.com", "fbcdn.net"];

export interface InstagramPost {
  data: Uint8Array<ArrayBuffer>;
  mime: string;
  seconds?: number;
  title?: string;
  author?: string;
  thumbnail?: string;
}

export const instagramProviderEnabled = () => !!process.env.INSTAGRAM_PROVIDER_TOKEN?.trim();

const isCdnUrl = (raw: unknown): raw is string => {
  if (typeof raw !== "string") return false;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && !url.port && CDN_DOMAINS.some((d) => isHostOf(url.hostname, d));
  } catch {
    return false;
  }
};

// Canonical post URL (/reel/<code>/), without tracking parameters.
export function instagramPostUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    if (!isHostOf(url.hostname, "instagram.com")) return null;
    const code = url.pathname.match(/^\/(?:[\w.]+\/)?(?:reels?|p|tv)\/([\w-]+)/)?.[1];
    return code ? `https://www.instagram.com/reel/${code}/` : null;
  } catch {
    return null;
  }
}

export async function fetchInstagramPost(rawUrl: string, maxBytes: number): Promise<InstagramPost | null> {
  const token = process.env.INSTAGRAM_PROVIDER_TOKEN?.trim();
  const postUrl = instagramPostUrl(rawUrl);
  if (!token || !postUrl) return null;
  const actor = process.env.INSTAGRAM_PROVIDER_ACTOR?.trim() || DEFAULT_ACTOR;
  const res = await fetch(`https://api.apify.com/v2/acts/${encodeURIComponent(actor)}/run-sync-get-dataset-items`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ directUrls: [postUrl], resultsType: "posts", resultsLimit: 1 }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!res.ok) {
    console.error("[video] instagram provider", res.status);
    return null;
  }
  const [item] = (await res.json().catch(() => [])) as Record<string, unknown>[];
  if (!item || !isCdnUrl(item.videoUrl)) return null;

  const video = await fetch(item.videoUrl, { redirect: "error", signal: AbortSignal.timeout(45_000) });
  if (!video.ok || !video.body) return null;
  return {
    data: await readCapped(video, maxBytes),
    mime: video.headers.get("content-type")?.split(";")[0] || "video/mp4",
    seconds: typeof item.videoDuration === "number" ? item.videoDuration : undefined,
    title: typeof item.caption === "string" && item.caption ? item.caption.slice(0, 2000) : undefined,
    author: typeof item.ownerUsername === "string" ? item.ownerUsername : undefined,
    thumbnail: isCdnUrl(item.displayUrl) ? item.displayUrl : undefined,
  };
}
