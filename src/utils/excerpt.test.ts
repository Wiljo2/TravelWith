import { describe, it, expect } from "vitest";
import { transcriptExcerpt } from "./excerpt";

const filler = (n: number) => Array.from({ length: n }, (_, i) => `relleno${i}`).join(" ");

describe("transcriptExcerpt", () => {
  it("returns short transcripts whole, without repeated words", () => {
    expect(transcriptExcerpt("hola hola chicos vamos a Disney", new Set())).toBe("hola chicos vamos a Disney");
  });

  it("keeps the opening and the passages about the trip, in order", () => {
    const text = `hoy les cuento ${filler(60)} en los outlets compren Nike ${filler(80)}`;
    const out = transcriptExcerpt(text, new Set(["outlets", "nike"]), 400);
    expect(out.startsWith("hoy les cuento")).toBe(true);
    expect(out).toContain("outlets compren Nike");
    expect(out).toContain("…");
    expect(out.length).toBeLessThanOrEqual(401);
  });
});
