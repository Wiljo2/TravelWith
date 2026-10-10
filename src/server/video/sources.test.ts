import { afterEach, describe, expect, it, vi } from "vitest";
import type { Idea } from "@/types";

vi.mock("@/lib/supabase-server", () => ({ createServerClient: () => ({}) }));
vi.mock("@/server/tiktok", async (original) => ({
  ...(await original<typeof import("@/server/tiktok")>()),
  resolveTikTokUrl: async (url: URL) => url,
  fetchTikTokVideo: vi.fn(),
}));

const tiktok = await import("@/server/tiktok");
const { resolveVideo, YOUTUBE_REASON } = await import("@/server/video/sources");
const { isAnalyzablePlatform, tooLongReason } = await import("@/utils/ideaVideo");

const idea = (url: string, platform: Idea["platform"]): Idea => ({ id: "i1", url, platform, createdAt: "2026-10-01T00:00:00.000Z" });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("resolveVideo", () => {
  it("never analyzes YouTube", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const r = await resolveVideo(idea("https://youtube.com/shorts/abc", "youtube"), "ROOM", 90);
    expect(r).toMatchObject({ ok: false, status: "skipped", skip: "platform", reason: YOUTUBE_REASON });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(isAnalyzablePlatform(idea("https://youtu.be/abc", "youtube"))).toBe(false);
    expect(isAnalyzablePlatform(idea("https://vt.tiktok.com/x/", "tiktok"))).toBe(true);
  });

  it("skips a TikTok longer than the limit", async () => {
    vi.mocked(tiktok.fetchTikTokVideo).mockRejectedValueOnce(new tiktok.VideoTooLongError(120));
    const r = await resolveVideo(idea("https://www.tiktok.com/@a/video/1", "tiktok"), "ROOM", 90);
    expect(r).toMatchObject({ ok: false, status: "skipped", skip: "tooLong", reason: tooLongReason(90) });
    expect(vi.mocked(tiktok.fetchTikTokVideo).mock.calls[0][2]).toBe(90);
  });

  it("skips a long Instagram reel before downloading it", async () => {
    vi.stubEnv("INSTAGRAM_PROVIDER_TOKEN", "t");
    const item = { videoUrl: "https://scontent.cdninstagram.com/v.mp4", videoDuration: 140 };
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify([item])));
    vi.stubGlobal("fetch", fetchMock);
    const r = await resolveVideo(idea("https://www.instagram.com/reel/abc/", "instagram"), "ROOM", 90);
    expect(r).toMatchObject({ ok: false, status: "skipped", skip: "tooLong", providerCalls: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
