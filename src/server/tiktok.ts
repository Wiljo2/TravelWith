import { isHostOf } from "@/utils/ideas";

// Public data of a TikTok video, read from its web page. Server-only: TikTok
// blocks these requests from browsers (CORS). No account or API key needed.

const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";
const SHORT_HOSTS = new Set(["vm.tiktok.com", "vt.tiktok.com"]);
const TRANSCRIPT_MAX = 3000;
// Subtitle files are served from TikTok's own CDNs. Anything else in the page's
// JSON is not fetched: the server must never request an arbitrary URL (SSRF).
const SUBTITLE_DOMAINS = ["tiktok.com", "tiktokcdn.com", "tiktokcdn-us.com", "tiktokv.com", "tiktokv.us", "byteoversea.com", "ibytedtos.com"];

const isTikTokUrl = (url: URL) =>
  (url.protocol === "https:" || url.protocol === "http:") && !url.port && isHostOf(url.hostname, "tiktok.com");

export function isSubtitleUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && !url.port && SUBTITLE_DOMAINS.some((d) => isHostOf(url.hostname, d));
  } catch {
    return false;
  }
}

// Video covers come from the same CDNs.
export const isTikTokCdnUrl = isSubtitleUrl;

export interface TikTokData {
  title?: string;        // caption
  author?: string;
  thumbnail?: string;
  tags: string[];        // hashtags + TikTok's own search keywords
  transcript: string;    // automatic speech recognition; "" when the video has none
}

interface SubtitleInfo { Url?: string; Source?: string; LanguageCodeName?: string; Format?: string }

// Short links (vm./vt.tiktok.com) redirect once to the canonical video URL.
export async function resolveTikTokUrl(url: URL, timeoutMs = 5000): Promise<URL> {
  if (!SHORT_HOSTS.has(url.host)) return url;
  const res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(timeoutMs) });
  const location = res.headers.get("location");
  if (!location) return url;
  const target = new URL(location, url);
  return isTikTokUrl(target) ? target : url;
}

// WebVTT → plain text: drops the header, cue numbers and timings, and repeated lines.
export function vttToText(vtt: string): string {
  const lines = vtt
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && l !== "WEBVTT" && !l.includes("-->") && !/^\d+$/.test(l) && !/^(NOTE|STYLE|Kind:|Language:)/.test(l));
  const out: string[] = [];
  for (const l of lines) if (out[out.length - 1] !== l) out.push(l);
  return out.join(" ").replace(/\s+/g, " ").trim();
}

// Follows redirects by hand, only while they stay on tiktok.com.
async function fetchTikTokPage(url: URL, hops = 3): Promise<Response | null> {
  const res = await fetch(url, { headers: { "User-Agent": BROWSER_UA }, redirect: "manual", signal: AbortSignal.timeout(8000) });
  const location = res.status >= 300 && res.status < 400 ? res.headers.get("location") : null;
  if (!location) return res;
  const next = new URL(location, url);
  return hops > 0 && isTikTokUrl(next) ? fetchTikTokPage(next, hops - 1) : null;
}

// The video page embeds its data as JSON (`__UNIVERSAL_DATA_FOR_REHYDRATION__`):
// caption, author, cover, hashtags, keywords and subtitle tracks.
export async function fetchTikTokData(url: URL): Promise<TikTokData | null> {
  if (!isTikTokUrl(url) || !url.pathname.includes("/video/")) return null;
  const res = await fetchTikTokPage(url);
  if (!res?.ok) return null;
  const json = (await res.text()).match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/)?.[1];
  if (!json) return null;
  const item = JSON.parse(json)?.__DEFAULT_SCOPE__?.["webapp.video-detail"]?.itemInfo?.itemStruct;
  if (!item?.desc && !item?.author?.uniqueId) return null;

  const hashtags: string[] = (item.textExtra ?? []).map((t: { hashtagName?: string }) => t.hashtagName).filter(Boolean);
  const keywords: string[] = Array.isArray(item.suggestedWords) ? item.suggestedWords : [];
  const tags = [...new Set([...hashtags, ...keywords].map((t) => String(t).trim()).filter(Boolean))].slice(0, 20);

  return {
    title: item.desc || undefined,
    author: item.author?.uniqueId,
    thumbnail: item.video?.cover || undefined,
    tags,
    transcript: await fetchTranscript(item.video?.subtitleInfos ?? []),
  };
}

// Prefers the original-language speech recognition (ASR) over machine translations.
async function fetchTranscript(tracks: SubtitleInfo[]): Promise<string> {
  const safe = tracks.filter((t) => t.Url && isSubtitleUrl(t.Url));
  const track = safe.find((t) => t.Source === "ASR") ?? safe[0];
  if (!track?.Url) return "";
  try {
    const res = await fetch(track.Url, {
      headers: { "User-Agent": BROWSER_UA, Referer: "https://www.tiktok.com/" },
      redirect: "error",   // a redirect could leave the allowed hosts
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return "";
    return vttToText(await res.text()).slice(0, TRANSCRIPT_MAX);
  } catch {
    return "";
  }
}
