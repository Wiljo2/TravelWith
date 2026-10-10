import { describe, expect, it, vi } from "vitest";
import type { Idea } from "@/types";

vi.mock("@/lib/supabase-server", () => ({ createServerClient: () => ({}) }));

const { MAX_ATTEMPTS, shouldAnalyze } = await import("@/server/video/analyze");

const idea: Idea = { id: "i1", url: "https://vt.tiktok.com/x/", platform: "tiktok", createdAt: "2026-10-01T00:00:00.000Z" };
const past = new Date(Date.now() - 60_000).toISOString();
const future = new Date(Date.now() + 60_000).toISOString();

describe("shouldAnalyze", () => {
  it("analyzes a new idea once", () => {
    expect(shouldAnalyze(idea, false)).toBe(true);
    expect(shouldAnalyze({ ...idea, video: { status: "done" } }, true)).toBe(false);
    expect(shouldAnalyze({ ...idea, parentId: "p" }, true)).toBe(false);
  });

  it("retries a failure only when its time came, up to the attempt limit", () => {
    expect(shouldAnalyze({ ...idea, video: { status: "failed", attempts: 1, retryAt: future } }, false)).toBe(false);
    expect(shouldAnalyze({ ...idea, video: { status: "failed", attempts: 1, retryAt: past } }, false)).toBe(true);
    expect(shouldAnalyze({ ...idea, video: { status: "failed", attempts: MAX_ATTEMPTS, retryAt: past } }, false)).toBe(false);
    expect(shouldAnalyze({ ...idea, video: { status: "failed" } }, false)).toBe(false);
  });

  it("lets a member retry anything but a running analysis", () => {
    expect(shouldAnalyze({ ...idea, video: { status: "needsFile" } }, true)).toBe(true);
    expect(shouldAnalyze({ ...idea, video: { status: "failed", attempts: MAX_ATTEMPTS } }, true)).toBe(true);
    expect(shouldAnalyze({ ...idea, video: { status: "pending", retryAt: future } }, true)).toBe(false);
    expect(shouldAnalyze({ ...idea, video: { status: "pending", retryAt: past } }, false)).toBe(true);
  });
});
