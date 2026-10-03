import { describe, it, expect } from "vitest";
import { initialDays } from "@/test/fixtures/initialDays";
import { tripPlaces } from "@/utils/places";
import { buildPlanPrompt, dayPhases, readAnswer } from "./ideaPlan";
import type { Idea } from "@/types";

const idea = (id: string, fields: Partial<Idea>): Idea => ({
  id, url: `https://x/${id}`, platform: "tiktok", createdAt: "2026-01-01T00:00:00Z", ...fields,
});
const payload = (ideas: Idea[]) => ({ days: initialDays, trip: { destination: "Florida & Bahamas" }, ideas }) as never;

describe("buildPlanPrompt", () => {
  const ideas = [
    idea("uuid-aaaa", { note: "qué comprar en los outlets", place: "Orlando" }),
    idea("uuid-bbbb", { title: "Tips", transcript: "hola chicos hoy vamos a Disney Springs a comer" }),
  ];

  it("uses short labels and maps them back to real ids", () => {
    const p = buildPlanPrompt(payload(ideas));
    expect(p.user).not.toContain("uuid-aaaa");
    expect(p.ideaIds.get("i1")).toBe("uuid-aaaa");
    expect(p.targets.get("D1")).toEqual({ dayId: "d0" });
    expect([...p.targets.keys()].some((k) => /^e\d+$/.test(k))).toBe(true);
    expect([...p.placeLabels.values()]).toContain("Orlando");
  });

  it("sends the trip overview apart from the ideas, so it can be cached", () => {
    const p = buildPlanPrompt(payload(ideas));
    expect(p.trip).toContain("LUGARES DEL VIAJE");
    expect(p.trip).toContain("crucero día 1 de 5 · embarque");
    expect(p.trip).not.toContain("hola chicos");
    expect(p.user).toContain("video: hola chicos hoy vamos a Disney Springs a comer");
  });

  it("includes logistics: car pickups and airports are where some tips go", () => {
    const p = buildPlanPrompt(payload(ideas));
    expect(p.trip).toContain("Check-in puerto");
    expect(p.trip).toContain("Vuelo");
  });

  it("doesn't bias the model with the group's place", () => {
    expect(buildPlanPrompt(payload(ideas)).user).not.toContain("Orlando");
  });

  it("can limit the prompt to some ideas", () => {
    const p = buildPlanPrompt(payload(ideas), ["uuid-bbbb"]);
    expect(p.count).toBe(1);
    expect(p.ideaIds.get("i1")).toBe("uuid-bbbb");
  });
});

describe("dayPhases", () => {
  it("marks each day of the cruise, the last night on board and disembarkation", () => {
    const phases = dayPhases(initialDays, tripPlaces(undefined, initialDays));
    expect(phases[0]).toBe(`día 1 de ${initialDays.length}`);
    const cruise = phases.filter((p) => p.includes("crucero día"));
    expect(cruise).toHaveLength(5);
    expect(cruise[3]).toContain("última noche a bordo");
    expect(cruise[4]).toContain("desembarque por la mañana");
  });
});

describe("readAnswer", () => {
  const p = buildPlanPrompt(payload([idea("uuid-aaaa", { note: "kit anti mareo" })]));
  const answer = (fields: Partial<Parameters<typeof readAnswer>[0][number]>) =>
    readAnswer([{ idea: "i1", reason: "Cómprenlo antes", place: "none", cat: "tip", before: false, target: "none", ...fields }], p);

  it("turns labels into ids and keeps 'before the trip'", () => {
    const { links, classes } = answer({ place: "P1", target: "D5", before: true });
    expect(links).toEqual([{ ideaId: "uuid-aaaa", dayId: "d4", before: true, reason: "Cómprenlo antes", source: "claude" }]);
    expect(classes[0]).toEqual({ ideaId: "uuid-aaaa", place: p.placeLabels.get("P1"), cat: "tip" });
  });

  it("accepts a place named instead of labeled", () => {
    expect(answer({ place: "crucero" }).classes[0].place).toBe("Crucero");
  });

  it("drops 'none' and invented labels", () => {
    const { links, classes } = answer({ target: "e999", cat: "none" });
    expect(links).toEqual([]);
    expect(classes).toEqual([]);
  });
});
