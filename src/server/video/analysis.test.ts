import { describe, expect, it } from "vitest";
import { initialDays } from "@/test/fixtures/initialDays";
import { ideaVideoArgs } from "@/server/domain/featureRows";
import { DomainError } from "@/server/domain/core";
import { childId, childIdeas, doneVideo, parseAnalysis, withVideo, MAX_SPOTS } from "@/server/video/analysis";
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

describe("childIdeas", () => {
  const analysis = parseAnalysis(raw)!;

  it("makes one idea per spot, with ids derived from the parent", () => {
    const children = childIdeas(parent, analysis, index);
    expect(children.map((c) => c.id)).toEqual(["idea-1-s0", "idea-1-s1", "idea-1-s2"]);
    expect(children[0]).toMatchObject({ parentId: "idea-1", title: "D-Luxe Burger", url: parent.url, addedBy: "ana" });
    expect(children[0].spot?.price).toBe("$8.99");
    expect(children[0].suggestion?.cat).toBe("comida");
  });

  it("doesn't split one-spot, off-topic or child videos", () => {
    expect(childIdeas(parent, { ...analysis, spots: analysis.spots.slice(0, 1) }, index)).toEqual([]);
    expect(childIdeas(parent, { ...analysis, relevant: false }, index)).toEqual([]);
    expect(childIdeas({ ...parent, parentId: "x" }, analysis, index)).toEqual([]);
  });

  it("keeps child ids within the id limit", () => {
    expect(childId("a".repeat(100), 11).length).toBeLessThanOrEqual(100);
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
    const [c] = childIdeas(parent, { relevant: true, summary: "x", spots: [
      { name: "Crucero de True Crime", city: "Miami", cat: "actividad" },
      { name: "Isla de los Mapaches", city: "Miami", cat: "actividad" },
    ] }, index);
    expect(c.suggestion?.place).toBe("Miami");
  });

  it("prefers a venue of the plan named by the spot", () => {
    const venues = index.places.filter((p) => p.eventIds.length > 0).map((p) => p.name);
    expect(venues).toContain("Disney Springs");
    const c = childIdeas(parent, { relevant: true, summary: "x", spots: [
      { name: "Sunshine Churros en Disney Springs", city: "Orlando", cat: "comida" },
      { name: "Otro", city: "Orlando", cat: "comida" },
    ] }, index)[0];
    expect(c.suggestion?.place).toBe("Disney Springs");
  });
});
