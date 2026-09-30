import { describe, it, expect } from "vitest";
import { initialDays } from "@/data/initialDays";
import { buildPlanPrompt } from "./ideaPlan";
import type { Idea } from "@/types";

const idea = (id: string, fields: Partial<Idea>): Idea => ({
  id, url: `https://x/${id}`, platform: "tiktok", createdAt: "2026-01-01T00:00:00Z", ...fields,
});
const payload = (ideas: Idea[]) => ({ days: initialDays, trip: { destination: "Florida & Bahamas" }, ideas }) as never;

describe("buildPlanPrompt", () => {
  const ideas = [
    idea("uuid-aaaa", { note: "qué comprar en los outlets" }),
    idea("uuid-bbbb", { title: "Tips", transcript: "hola chicos hoy vamos a Disney Springs a comer" }),
  ];

  it("uses short labels and maps them back to real ids", () => {
    const p = buildPlanPrompt(payload(ideas));
    expect(p.user).not.toContain("uuid-aaaa");
    expect(p.ideaIds.get("i1")).toBe("uuid-aaaa");
    expect(p.targets.get("D1")).toEqual({ dayId: "d0" });
    expect([...p.targets.keys()].some((k) => /^e\d+$/.test(k))).toBe(true);
  });

  it("includes the places and what the video says", () => {
    const p = buildPlanPrompt(payload(ideas));
    expect(p.user).toContain("Orlando Premium Outlets (Nike, Coach, Michael Kors)");
    expect(p.user).toContain("video: hola chicos hoy vamos a Disney Springs a comer");
  });

  it("leaves out logistics, except the cruise check-in", () => {
    const p = buildPlanPrompt(payload(ideas));
    expect(p.user).not.toContain("Recogida de carros");
    expect(p.user).toContain("Check-in puerto");
  });

  it("can limit the prompt to some ideas", () => {
    const p = buildPlanPrompt(payload(ideas), ["uuid-bbbb"]);
    expect(p.count).toBe(1);
    expect(p.ideaIds.get("i1")).toBe("uuid-bbbb");
  });
});
