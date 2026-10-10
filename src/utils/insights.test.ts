import { describe, expect, it } from "vitest";
import { videoContribution } from "@/utils/insights";
import type { Idea } from "@/types";

const idea: Idea = { id: "i", url: "https://vt.tiktok.com/x/", platform: "tiktok", createdAt: "2026-10-01T00:00:00.000Z" };

describe("videoContribution", () => {
  it("counts what an analyzed video brings", () => {
    const c = videoContribution({
      ...idea,
      video: {
        status: "done",
        spots: [{ name: "Windjammer" }],
        insights: [{ kind: "tip", text: "a" }, { kind: "tip", text: "b" }, { kind: "todo", text: "c" }],
      },
    });
    expect(c?.map((p) => `${p.icon}${p.count}`)).toEqual(["✅1", "💡2", "📍1"]);
  });

  it("says nothing for unanalyzed videos and spot ideas, and empty for useless ones", () => {
    expect(videoContribution(idea)).toBeUndefined();
    expect(videoContribution({ ...idea, spot: { name: "x" }, video: { status: "done" } })).toBeUndefined();
    expect(videoContribution({ ...idea, video: { status: "done", relevant: false, spots: [{ name: "x" }] } })).toEqual([]);
    expect(videoContribution({ ...idea, video: { status: "done", spots: [], insights: [] } })).toEqual([]);
  });
});
