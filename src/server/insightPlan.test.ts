import { describe, expect, it } from "vitest";
import { initialDays } from "@/test/fixtures/initialDays";
import { buildPlanPrompt } from "@/server/ideaPlan";
import { describeInsights, insightSources, readInsightAnswers } from "@/server/insightPlan";
import type { Idea } from "@/types";

const idea = (id: string, fields: Partial<Idea>): Idea => ({
  id, url: `https://x/${id}`, platform: "tiktok", createdAt: "2026-01-01T00:00:00Z", ...fields,
});
const withAdvice = idea("vid-1", {
  title: "5 errores en tu primer crucero",
  video: { status: "done", insights: [
    { kind: "todo", text: "Reserva los shows en la app", phase: "before", when: "60 días antes" },
    { kind: "tip", text: "Almuerza en el buffet del piso 15", phase: "first", start: 11.5, end: 13, brand: "Royal Caribbean" },
  ] },
});
const useless = idea("vid-2", { video: { status: "done", relevant: false, insights: [{ kind: "fact", text: "x" }] } });
const split = idea("vid-3", { video: { status: "done", insights: [{ kind: "avoid", text: "No vayas sin reserva" }] } });
const child = idea("vid-3-s0", { parentId: "vid-3", spot: { name: "A" } });

describe("insightSources", () => {
  it("sends analyzed travel videos with advice; with onlyIds, those or their spot ideas", () => {
    const all = [withAdvice, useless, split, child];
    expect(insightSources(all).map((i) => i.id)).toEqual(["vid-1", "vid-3"]);
    expect(insightSources(all, ["vid-3-s0"]).map((i) => i.id)).toEqual(["vid-3"]);
    expect(insightSources(all, ["other"])).toEqual([]);
  });
});

describe("describeInsights", () => {
  it("labels each insight and keeps when it matters", () => {
    const d = describeInsights([withAdvice]);
    expect(d.labels.get("n1")).toBe("vid-1:i0");
    expect(d.labels.get("n2")).toBe("vid-1:i1");
    expect(d.text).toContain("n1 [Por hacer] Reserva los shows en la app · antes del viaje · cuándo: 60 días antes");
    expect(d.text).toContain("de: Royal Caribbean");
    expect(d.text).toContain("(video: 5 errores en tu primer crucero)");
  });
});

describe("plan prompt with insights", () => {
  const payload = {
    days: initialDays, trip: { destination: "Florida & Bahamas", startDate: "2026-11-10", endDate: "2026-11-18" }, ideas: [withAdvice],
  } as never;

  it("adds the trip dates to the cached block and the advice to the request", () => {
    const p = buildPlanPrompt(payload);
    expect(p.trip.startsWith("FECHAS: del 2026-11-10 al 2026-11-18")).toBe(true);
    expect(p.user).toContain("CONSEJOS\nn1 [Por hacer]");
    expect(p.insightCount).toBe(2);
    expect(p.insightSourceIds).toEqual(["vid-1"]);
    expect(p.system).toContain("status");
  });

  it("reads answers back: targets, deadlines, statuses", () => {
    const p = buildPlanPrompt(payload);
    const links = readInsightAnswers([
      { insight: "n1", target: "D1", before: true, deadline: "2026-09-11", status: "new", reason: "Se llenan" },
      { insight: "n2", target: "e999", before: false, deadline: "", status: "na", reason: "Es de otra naviera" },
      { insight: "n9", target: "D1", before: false, deadline: "", status: "new", reason: "" },
      { insight: "n1", target: "D2", before: false, deadline: "", status: "new", reason: "duplicado" },
    ], p.insightLabels, p.targets, p.tripEnd);
    expect(links).toEqual([
      { insightId: "vid-1:i0", dayId: "d0", before: true, deadline: "2026-09-11", status: "new", reason: "Se llenan" },
      { insightId: "vid-1:i1", status: "na", reason: "Es de otra naviera" },
    ]);
  });

  it("drops deadlines that aren't dates or fall after the trip", () => {
    const p = buildPlanPrompt(payload);
    const [a, b] = readInsightAnswers([
      { insight: "n1", target: "none", before: true, deadline: "pronto", status: "weird", reason: "" },
      { insight: "n2", target: "none", before: false, deadline: "2027-01-01", status: "covered", reason: "" },
    ], p.insightLabels, p.targets, p.tripEnd);
    expect(a).toEqual({ insightId: "vid-1:i0", before: true, status: "new" });
    expect(b).toEqual({ insightId: "vid-1:i1", status: "covered" });
  });
});
