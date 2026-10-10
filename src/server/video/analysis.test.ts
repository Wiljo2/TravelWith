import { describe, expect, it } from "vitest";
import { initialDays } from "@/test/fixtures/initialDays";
import { ideaVideoArgs } from "@/server/domain/featureRows";
import { DomainError } from "@/server/domain/core";
import { doneVideo, parseAnalysis, withVideo, MAX_INSIGHTS, MAX_SPOTS } from "@/server/video/analysis";
import { hideSplitVideos, isAutoSpotIdea, spotIdea, spotIdeaId } from "@/utils/ideaVideo";
import { analysisPrompt } from "@/server/video/analysisPrompt";
import { placeIndex } from "@/utils/ideas";
import { tripPlaces } from "@/utils/places";
import type { Idea } from "@/types";

const index = placeIndex(tripPlaces("Florida & Bahamas", initialDays), initialDays);

const parent: Idea = {
  id: "idea-1",
  url: "https://vt.tiktok.com/ZSbSHy89A/",
  platform: "tiktok",
  createdAt: "2026-10-01T00:00:00.000Z",
  title: "UNDER $10 DISNEY SPRINGS",
  thumbnail: "https://p16.tiktokcdn.com/cover.jpg",
  addedBy: "ana",
  version: 3,
};

const raw = {
  relevant: true,
  summary: "  Comida y recuerdos por menos de $10 en Disney Springs.  ",
  onScreen: "D-LUXE BURGER / SUNSHINE CHURROS",
  spots: [
    { name: "D-Luxe Burger", city: "Disney Springs", cat: "comida", at: 3.4, price: "$8.99" },
    { name: "Sunshine Churros", city: "Disney Springs", cat: "comida", at: 20 },
    { name: "d-luxe burger", cat: "comida" },
    { name: "", cat: "comida" },
    { name: "Coca-Cola Store", cat: "souvenirs", at: -2 },
  ],
};

describe("parseAnalysis", () => {
  it("cleans the model output", () => {
    const a = parseAnalysis(raw)!;
    expect(a.summary).toBe("Comida y recuerdos por menos de $10 en Disney Springs.");
    expect(a.spots.map((s) => s.name)).toEqual(["D-Luxe Burger", "Sunshine Churros", "Coca-Cola Store"]);
    expect(a.spots[0].at).toBe(3);
    expect(a.spots[2].cat).toBeUndefined();
    expect(a.spots[2].at).toBeUndefined();
  });

  it("rejects answers without a summary and caps the spots", () => {
    expect(parseAnalysis({ spots: [] })).toBeNull();
    expect(parseAnalysis("nope")).toBeNull();
    const many = { summary: "x", spots: Array.from({ length: 20 }, (_, i) => ({ name: `Spot ${i}`, cat: "tip" })) };
    expect(parseAnalysis(many)!.spots).toHaveLength(MAX_SPOTS);
  });

  it("treats a missing relevance as relevant", () => {
    expect(parseAnalysis({ summary: "x", spots: [] })!.relevant).toBe(true);
    expect(parseAnalysis({ summary: "x", relevant: false, spots: [] })!.relevant).toBe(false);
  });
});

describe("spotIdea", () => {
  const analysis = parseAnalysis(raw)!;

  it("saves a spot as an idea of its own, with an id from the parent and the spot name", () => {
    const spot = spotIdea(parent, analysis.spots[0], index, "beto");
    expect(spot.id).toBe("idea-1-s-d-luxe-burger");
    expect(spot).toMatchObject({ parentId: "idea-1", title: "D-Luxe Burger", url: parent.url, addedBy: "beto" });
    expect(spot.spot?.price).toBe("$8.99");
    expect(spot.suggestion?.cat).toBe("comida");
  });

  it("keeps ids within the id limit and allowed characters", () => {
    const id = spotIdeaId("a".repeat(100), { name: "Café Ñandú & Co. — 2º piso, súper largo nombre de lugar" });
    expect(id.length).toBeLessThanOrEqual(100);
    expect(id).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("only spot ideas made by the old automatic split hide their video", () => {
    const saved = spotIdea(parent, analysis.spots[0], index);
    expect(isAutoSpotIdea(saved)).toBe(false);
    expect(hideSplitVideos([parent, saved]).map((i) => i.id)).toEqual(["idea-1", saved.id]);
    const auto: Idea = { ...saved, id: "idea-1-s0" };
    expect(isAutoSpotIdea(auto)).toBe(true);
    expect(hideSplitVideos([parent, auto]).map((i) => i.id)).toEqual(["idea-1-s0"]);
  });
});

describe("withVideo", () => {
  const video = doneVideo(parseAnalysis(raw)!, "gemini-3.8-flash", 1);

  it("keeps the group's edits and only adds the analysis", () => {
    const current: Idea = { ...parent, note: "vamos el día 2", votes: ["ana"], place: "Orlando", cat: "comida" };
    const next = withVideo(current, video, index);
    expect(next).toMatchObject({ note: "vamos el día 2", votes: ["ana"], place: "Orlando", cat: "comida" });
    expect(next.video?.status).toBe("done");
  });

  it("keeps Claude's suggestion", () => {
    const current: Idea = { ...parent, suggestion: { place: "Miami", source: "claude" } };
    expect(withVideo(current, video, index).suggestion).toEqual({ place: "Miami", source: "claude" });
  });

  it("writes failures as they are", () => {
    const next = withVideo(parent, { status: "failed", reason: "x" }, index);
    expect(next.video).toEqual({ status: "failed", reason: "x" });
  });
});

describe("ideaVideoArgs", () => {
  const idea = { url: parent.url, platform: "tiktok", createdAt: parent.createdAt };

  it("accepts children derived from the parent", () => {
    const out = ideaVideoArgs({ id: "idea-1", idea, children: [{ id: "idea-1-s0", idea }] });
    expect(out.children).toHaveLength(1);
  });

  it("rejects foreign child ids and too many children", () => {
    expect(() => ideaVideoArgs({ id: "idea-1", idea, children: [{ id: "other-s0", idea }] })).toThrow(DomainError);
    const many = Array.from({ length: 13 }, (_, i) => ({ id: `idea-1-s${i}`, idea }));
    expect(() => ideaVideoArgs({ id: "idea-1", idea, children: many })).toThrow(DomainError);
  });
});

describe("spot ideas' place", () => {
  it("trusts the spot's city over a passing word in its name", () => {
    const c = spotIdea(parent, { name: "Crucero de True Crime", city: "Miami", cat: "actividad" }, index);
    expect(c.suggestion?.place).toBe("Miami");
  });

  it("prefers a venue of the plan named by the spot", () => {
    const venues = index.places.filter((p) => p.eventIds.length > 0).map((p) => p.name);
    expect(venues).toContain("Disney Springs");
    const c = spotIdea(parent, { name: "Sunshine Churros en Disney Springs", city: "Orlando", cat: "comida" }, index);
    expect(c.suggestion?.place).toBe("Disney Springs");
  });
});

describe("insights", () => {
  const base = { relevant: true, summary: "Consejos de crucero", spots: [] };

  it("keeps valid insights and cleans them", () => {
    const a = parseAnalysis({
      ...base,
      insights: [
        { kind: "todo", text: " Reserva los shows   en la app ", phase: "before", when: "60 días antes", at: 4.6 },
        { kind: "tip", text: "Almuerza en el buffet del piso 14", phase: "first", start: 11.5, end: 13, place: "Crucero" },
        { kind: "tip", text: "reserva los shows en la app" },
        { kind: "souvenir", text: "Compra imanes" },
        { kind: "avoid", text: "" },
        { kind: "fact", text: "El wifi cuesta $25 al día", phase: "sometime", start: 30, end: 2 },
      ],
    })!;
    expect(a.insights).toEqual([
      { kind: "todo", text: "Reserva los shows en la app", phase: "before", when: "60 días antes", at: 5, start: undefined, end: undefined, place: undefined, brand: undefined },
      { kind: "tip", text: "Almuerza en el buffet del piso 14", phase: "first", start: 11.5, end: 13, place: "Crucero", when: undefined, brand: undefined, at: undefined },
      { kind: "fact", text: "El wifi cuesta $25 al día", phase: undefined, start: undefined, end: undefined, when: undefined, place: undefined, brand: undefined, at: undefined },
    ]);
  });

  it("drops an end hour that isn't after the start", () => {
    const a = parseAnalysis({ ...base, insights: [{ kind: "tip", text: "Piscina temprano", start: 9, end: 8 }] })!;
    expect(a.insights?.[0]).toMatchObject({ start: 9, end: undefined });
  });

  it("caps the list and stores it on the video", () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ kind: "fact", text: `Dato número ${i}` }));
    const a = parseAnalysis({ ...base, insights: many })!;
    expect(a.insights).toHaveLength(MAX_INSIGHTS);
    const video = doneVideo(a, "m", 1);
    expect(video.insights?.[0]).toEqual({ kind: "fact", text: "Dato número 0" });
  });

  it("reads videos analyzed before insights existed", () => {
    expect(parseAnalysis(base)?.insights).toEqual([]);
  });
});

describe("analysisPrompt", () => {
  it("passes the post text and the trip places", () => {
    const p = analysisPrompt({ places: ["Crucero", "Miami"], caption: "5 errores en tu primer crucero", transcript: "hola" });
    expect(p).toContain("Lugares del viaje: Crucero, Miami.");
    expect(p).toContain("Texto del post: 5 errores en tu primer crucero");
    expect(p).toContain("Subtítulos automáticos: hola");
    expect(analysisPrompt({ places: [] })).not.toContain("Texto del post");
  });
});

describe("withVideo and the group's take on insights", () => {
  it("drops votes on the old insights when a new analysis renumbers them", () => {
    const voted: Idea = { ...parent, insightStates: { 0: { votes: ["ana"] } } };
    expect(withVideo(voted, { status: "done", insights: [] }, null).insightStates).toBeUndefined();
    expect(withVideo(voted, { status: "failed" }, null).insightStates).toEqual({ 0: { votes: ["ana"] } });
  });
});
