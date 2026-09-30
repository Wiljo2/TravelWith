import { describe, it, expect } from "vitest";
import { isSubtitleUrl, vttToText } from "./tiktok";

describe("vttToText", () => {
  it("keeps only the spoken text, without timings or repeated lines", () => {
    const vtt = [
      "WEBVTT",
      "",
      "1",
      "00:00:00.120 --> 00:00:02.500",
      "esto es lo que muchos no saben",
      "",
      "2",
      "00:00:02.500 --> 00:00:04.000",
      "esto es lo que muchos no saben",
      "del vaso recargable de Universal",
    ].join("\n");
    expect(vttToText(vtt)).toBe("esto es lo que muchos no saben del vaso recargable de Universal");
  });

  it("returns empty text for an empty track", () => {
    expect(vttToText("WEBVTT\n\n")).toBe("");
  });
});

describe("isSubtitleUrl", () => {
  it("accepts https subtitle files on TikTok's CDNs", () => {
    expect(isSubtitleUrl("https://v16-webapp.tiktok.com/abc/sub.vtt")).toBe(true);
    expect(isSubtitleUrl("https://v19.tiktokcdn-us.com/abc")).toBe(true);
  });
  it("rejects lookalike hosts, internal addresses and other schemes", () => {
    expect(isSubtitleUrl("https://eviltiktok.com/x")).toBe(false);
    expect(isSubtitleUrl("https://tiktok.com.evil.io/x")).toBe(false);
    expect(isSubtitleUrl("http://169.254.169.254/latest/meta-data")).toBe(false);
    expect(isSubtitleUrl("http://v16-webapp.tiktok.com/x")).toBe(false);
    expect(isSubtitleUrl("https://v16-webapp.tiktok.com:8080/x")).toBe(false);
    expect(isSubtitleUrl("not a url")).toBe(false);
  });
});
