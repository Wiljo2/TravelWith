import { NextResponse } from "next/server";
import { requireMember } from "@/server/auth";
import { errorResponse, roomCodeParam } from "@/server/http";
import { LOCAL_MODE_ENABLED, LOCAL_ROOM_CODE } from "@/data/localMode";
import { detectPlatform } from "@/utils/ideas";
import { fetchTikTokData, resolveTikTokUrl } from "@/server/tiktok";

type Params = Promise<{ code: string }>;

const TIMEOUT_MS = 5000;

interface OEmbed {
  title?: string;
  author_name?: string;
  thumbnail_url?: string;
}

async function fetchOEmbed(endpoint: string): Promise<OEmbed | null> {
  let res = await fetch(endpoint, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  // TikTok rate-limits oEmbed per IP ("ratelimit triggered"); one short retry often passes.
  if (res.status === 429) {
    await new Promise((r) => setTimeout(r, 1500));
    res = await fetch(endpoint, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  }
  return res.ok ? ((await res.json()) as OEmbed) : null;
}

// GET /api/rooms/[code]/oembed?url=… — public post data for an idea link, free
// and without API keys. TikTok: caption, hashtags, keywords and the automatic
// transcript from the video page (oEmbed as fallback). YouTube: oEmbed.
// Instagram requires a Meta app token, so it returns nothing.
// Members only (the dev-only LOCAL room excepted), so the server can't be used
// as an open proxy for these platforms.
export async function GET(req: Request, { params }: { params: Params }) {
  try {
    const code = roomCodeParam((await params).code);
    if (!(LOCAL_MODE_ENABLED && code === LOCAL_ROOM_CODE)) await requireMember(req, code);
  } catch (e) {
    return errorResponse(e, "GET /api/rooms/[code]/oembed");
  }

  let url: URL;
  try {
    url = new URL(new URL(req.url).searchParams.get("url") ?? "");
  } catch {
    return NextResponse.json({ error: "URL inválida" }, { status: 400 });
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return NextResponse.json({ error: "URL inválida" }, { status: 400 });
  }

  const platform = detectPlatform(url.href);
  try {
    if (platform === "tiktok") {
      url = await resolveTikTokUrl(url, TIMEOUT_MS);
      const page = await fetchTikTokData(url).catch(() => null);
      if (page) {
        return NextResponse.json({
          platform,
          url: url.href,
          title: page.title?.slice(0, 500),
          author: page.author?.slice(0, 120),
          thumbnail: page.thumbnail,
          tags: page.tags,
          transcript: page.transcript,
        });
      }
      const data = await fetchOEmbed(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url.href)}`);
      if (!data) return NextResponse.json({ platform, url: url.href, error: "unavailable" });
      return NextResponse.json({
        platform,
        url: url.href,
        title: data.title?.slice(0, 500) || undefined,
        author: data.author_name?.slice(0, 120) || undefined,
        thumbnail: data.thumbnail_url || undefined,
      });
    }

    if (platform === "youtube") {
      const data = await fetchOEmbed(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url.href)}`);
      if (!data) return NextResponse.json({ platform, url: url.href, error: "unavailable" });
      return NextResponse.json({
        platform,
        url: url.href,
        title: data.title?.slice(0, 500) || undefined,
        author: data.author_name?.slice(0, 120) || undefined,
        thumbnail: data.thumbnail_url || undefined,
      });
    }

    return NextResponse.json({ platform });
  } catch {
    // Network errors or timeouts: the idea is still saved, just without metadata.
    return NextResponse.json({ platform });
  }
}
