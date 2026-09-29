import { describe, it, expect } from "vitest";
import { vttToText } from "./tiktok";

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
