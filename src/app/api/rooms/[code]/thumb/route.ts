import { NextResponse } from "next/server";
import { normalizeRoomCode } from "@/lib/validate";
import { detectPlatform } from "@/utils/ideas";
import { tiktokVideoId, youtubeVideoId } from "@/utils/ideaMedia";
import { fetchTikTokData, isTikTokCdnUrl, resolveTikTokUrl } from "@/server/tiktok";

type Params = Promise<{ code: string }>;

const TIMEOUT_MS = 6000;
// A cover never changes: browsers and the CDN keep it a week.
const CACHE = "public, max-age=604800, s-maxage=604800, stale-while-revalidate=86400";
// TikTok answers 429 to bursts (a board loads every cover at once): at most two
// lookups at a time, and a couple of patient retries.
const MAX_PARALLEL = 2;
const RETRY_MS = [1200, 2500];

let running = 0;
const waiting: (() => void)[] = [];
async function limited<T>(task: () => Promise<T>): Promise<T> {
  if (running >= MAX_PARALLEL) await new Promise<void>((go) => waiting.push(go));
  running++;
  try {
    return await task();
  } finally {
    running--;
    waiting.shift()?.();
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function tiktokCover(url: URL): Promise<string | undefined> {
  for (let attempt = 0; attempt <= RETRY_MS.length; attempt++) {
    const res = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url.href)}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (res.ok) return ((await res.json()) as { thumbnail_url?: string }).thumbnail_url;
    if (res.status !== 429 || attempt === RETRY_MS.length) break;
    await sleep(RETRY_MS[attempt]);
  }
  // oEmbed unavailable: the video page has the cover too.
  return (await fetchTikTokData(url).catch(() => null))?.thumbnail;
}

// The cover image URL of a TikTok or YouTube post, fresh (TikTok's are signed
// and expire), or null.
async function coverUrl(raw: string): Promise<string | null> {
  const platform = detectPlatform(raw);
  if (platform === "youtube") {
    const id = youtubeVideoId(raw);
    return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
  }
  if (platform !== "tiktok") return null;
  const thumb = await limited(async () => tiktokCover(await resolveTikTokUrl(new URL(raw), TIMEOUT_MS)));
  // Only TikTok's own CDNs are fetched: never an arbitrary URL (SSRF).
  return thumb && isTikTokCdnUrl(thumb) ? thumb : null;
}

export const maxDuration = 30;

const notFound = () => new NextResponse(null, { status: 404, headers: { "Cache-Control": "no-store" } });

// GET /api/rooms/[code]/thumb?url=… — an idea's cover image, served from here so
// it loads even when the stored one expired (and the service worker can keep
// it for offline use). With &format=json, just the fresh cover URL, so the
// client can store it for the whole group: { thumbnail }. With &format=id, the
// TikTok video id behind a short link: { embedId }.
export async function GET(req: Request, { params }: { params: Params }) {
  if (!normalizeRoomCode((await params).code)) return new NextResponse(null, { status: 400 });
  const query = new URL(req.url).searchParams;
  const raw = query.get("url") ?? "";
  try {
    // &format=id: the video id of a short TikTok link, for the in-app player.
    if (query.get("format") === "id") {
      if (detectPlatform(raw) !== "tiktok") return notFound();
      const id = tiktokVideoId((await resolveTikTokUrl(new URL(raw), TIMEOUT_MS)).href);
      return id ? NextResponse.json({ embedId: id }, { headers: { "Cache-Control": CACHE } }) : notFound();
    }
    const cover = await coverUrl(raw);
    if (!cover) return notFound();
    if (query.get("format") === "json") return NextResponse.json({ thumbnail: cover }, { headers: { "Cache-Control": "no-store" } });
    const img = await fetch(cover, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    const type = img.headers.get("content-type") ?? "";
    if (!img.ok || !type.startsWith("image/")) return notFound();
    return new NextResponse(img.body, { headers: { "Content-Type": type, "Cache-Control": CACHE } });
  } catch {
    return notFound();
  }
}
