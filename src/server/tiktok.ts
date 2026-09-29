// Public data of a TikTok video, read from its web page. Server-only: TikTok
// blocks these requests from browsers (CORS). No account or API key needed.

const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";
const SHORT_HOSTS = new Set(["vm.tiktok.com", "vt.tiktok.com"]);
const TRANSCRIPT_MAX = 3000;

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
  return target.host.endsWith("tiktok.com") ? target : url;
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

// The video page embeds its data as JSON (`__UNIVERSAL_DATA_FOR_REHYDRATION__`):
// caption, author, cover, hashtags, keywords and subtitle tracks.
export async function fetchTikTokData(url: URL): Promise<TikTokData | null> {
  if (!url.host.endsWith("tiktok.com") || !url.pathname.includes("/video/")) return null;
  const res = await fetch(url, { headers: { "User-Agent": BROWSER_UA }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) return null;
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
  const track = tracks.find((t) => t.Source === "ASR" && t.Url) ?? tracks.find((t) => t.Url);
  if (!track?.Url) return "";
  try {
    const res = await fetch(track.Url, {
      headers: { "User-Agent": BROWSER_UA, Referer: "https://www.tiktok.com/" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return "";
    return vttToText(await res.text()).slice(0, TRANSCRIPT_MAX);
  } catch {
    return "";
  }
}
