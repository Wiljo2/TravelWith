import { describe, expect, it } from "vitest";
import { collectInsights, fmtDeadline, momentGroups, momentLabel, videoContribution } from "@/utils/insights";
import type { Idea, IdeaInsight } from "@/types";

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

describe("collectInsights", () => {
  const done = (insights: IdeaInsight[], spots: string[] = []) =>
    ({ status: "done" as const, insights, spots: spots.map((name) => ({ name })) });
  const v1: Idea = { ...idea, id: "v1", place: "Crucero", video: done([
    { kind: "todo", text: "Reserva los shows en la app antes de embarcar", phase: "before" },
    { kind: "tip", text: "Almuerza en el buffet del piso 14", phase: "first", start: 12 },
  ], ["Windjammer"]) };
  const v2: Idea = { ...idea, id: "v2", place: "Crucero", video: done([
    { kind: "todo", text: "Reserva en la app los shows antes de embarcar" },
    { kind: "tip", text: "Ve temprano a la piscina", phase: "first", start: 8 },
  ], ["windjammer"]) };
  const v3: Idea = { ...idea, id: "v3", video: { status: "done", relevant: false, insights: [{ kind: "fact", text: "x" }] } };
  const parent: Idea = { ...idea, id: "v4", video: done([], ["A", "B"]) };
  const kids: Idea[] = [
    { ...idea, id: "v4-s0", parentId: "v4", place: "Miami", spot: { name: "A" } },
    { ...idea, id: "v4-s1", parentId: "v4", place: "Miami", spot: { name: "B" } },
  ];
  const zoneOf = (i: Idea) => i.place ?? "none";

  it("groups by zone and counts repeated advice and places once", () => {
    const d = collectInsights([v1, v2, v3, parent, ...kids], zoneOf);
    const cruise = d.get("Crucero")!;
    expect(cruise.videos.map((v) => v.id)).toEqual(["v1", "v2"]);
    expect(cruise.insights.map((i) => [i.id, i.sources])).toEqual([
      ["v1:i0", ["v1", "v2"]],
      ["v1:i1", ["v1"]],
      ["v2:i1", ["v2"]],
    ]);
    expect(cruise.spots.map((s) => [s.spot.name, s.sources.length])).toEqual([["Windjammer", 2]]);
    expect(d.get("none")?.insights).toEqual([]);
    expect(d.get("Miami")?.videos.map((v) => v.id)).toEqual(["v4"]);
  });

  it("orders advice by moment and hour", () => {
    const cruise = collectInsights([v1, v2], zoneOf).get("Crucero")!;
    const groups = momentGroups(cruise.insights.filter((i) => i.insight.kind === "tip"), [], "Crucero");
    expect(groups.map((g) => [g.label, g.items.map((i) => i.insight.start)])).toEqual([["Embarque", [8, 12]]]);
    expect(momentLabel("first", "Miami")).toBe("Primer día");
  });
});

describe("with Claude's links", () => {
  const days = [
    { id: "d1", label: "Sáb · Nov 14", sub: "Embarque", flexible: false, events: [{ id: "e1", start: 12, end: 13, title: "Almuerzo", cat: "comida", note: "" }] },
    { id: "d2", label: "Dom · Nov 15", sub: "Día en el mar", flexible: false, events: [] },
  ];
  const video: Idea = { ...idea, id: "v", place: "Crucero", video: { status: "done", insights: [
    { kind: "tip", text: "Piscina temprano", phase: "during", start: 7 },
    { kind: "tip", text: "Buffet del piso 15", phase: "first" },
    { kind: "tip", text: "Lleva protector solar", phase: "before" },
    { kind: "tip", text: "Usa la app", phase: "anytime" },
  ] } };
  const links = [
    { insightId: "v:i0", dayId: "d2", status: "new" as const },
    { insightId: "v:i1", dayId: "d1", eventId: "e1", status: "new" as const },
    { insightId: "v:i2", status: "covered" as const, reason: "Ya está en la lista" },
  ];

  it("attaches each link and groups by the real day, in trip order", () => {
    const cruise = collectInsights([video], (i) => i.place ?? "none", links).get("Crucero")!;
    expect(cruise.insights[2].link?.status).toBe("covered");
    const groups = momentGroups(cruise.insights.filter((i) => i.link?.status !== "covered"), days, "Crucero");
    expect(groups.map((g) => [g.label, g.items.map((i) => i.insight.text)])).toEqual([
      ["Sáb · Nov 14 · Embarque", ["Buffet del piso 15"]],
      ["Dom · Nov 15 · Día en el mar", ["Piscina temprano"]],
      ["Cuando sea", ["Usa la app"]],
    ]);
  });

  it("formats a deadline", () => {
    expect(fmtDeadline("2026-09-11")).toBe("antes de Sep 11");
  });
});
