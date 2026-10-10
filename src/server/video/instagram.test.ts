import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchInstagramPost, instagramPostUrl } from "@/server/video/instagram";

describe("instagramPostUrl", () => {
  it("normalizes reels, posts and profile-scoped links", () => {
    expect(instagramPostUrl("https://www.instagram.com/reels/DeF4DdBtrGJ/?igsh=abc")).toBe("https://www.instagram.com/reel/DeF4DdBtrGJ/");
    expect(instagramPostUrl("https://instagram.com/p/Cxyz_1-2/")).toBe("https://www.instagram.com/reel/Cxyz_1-2/");
    expect(instagramPostUrl("https://www.instagram.com/some.user/reel/DeOKP95R48u/")).toBe("https://www.instagram.com/reel/DeOKP95R48u/");
  });

  it("rejects other hosts and profile pages", () => {
    expect(instagramPostUrl("https://evil.com/reel/abc/")).toBeNull();
    expect(instagramPostUrl("https://www.instagram.com/some.user/")).toBeNull();
    expect(instagramPostUrl("not a url")).toBeNull();
  });
});

describe("fetchInstagramPost", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("never downloads a video URL outside Instagram's CDN", async () => {
    vi.stubEnv("INSTAGRAM_PROVIDER_TOKEN", "t");
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify([{ videoUrl: "https://169.254.169.254/latest" }])));
    vi.stubGlobal("fetch", fetchMock);
    expect(await fetchInstagramPost("https://www.instagram.com/reel/abc/", 1000)).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns the video and the post data", async () => {
    vi.stubEnv("INSTAGRAM_PROVIDER_TOKEN", "t");
    const item = { videoUrl: "https://scontent.cdninstagram.com/v.mp4", caption: "3 planes en Miami", ownerUsername: "ana", videoDuration: 64, displayUrl: "https://x.fbcdn.net/c.jpg" };
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([item])))
      .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "video/mp4" } })));
    const post = await fetchInstagramPost("https://www.instagram.com/reel/abc/", 1000);
    expect(post).toMatchObject({ mime: "video/mp4", seconds: 64, title: "3 planes en Miami", author: "ana", thumbnail: item.displayUrl });
    expect(post?.data.byteLength).toBe(3);
  });

  it("is off without a token", async () => {
    vi.stubEnv("INSTAGRAM_PROVIDER_TOKEN", "");
    expect(await fetchInstagramPost("https://www.instagram.com/reel/abc/", 1000)).toBeNull();
  });
});
