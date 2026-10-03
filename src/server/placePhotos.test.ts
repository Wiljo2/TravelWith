import { afterEach, describe, it, expect, vi } from "vitest";
import { findPhoto, withPhotos } from "./placePhotos";
import type { EventPlace } from "@/types";

type Page = { title: string; fullurl?: string; thumbnail?: { source: string }; coordinates?: { lat: number; lon: number }[] };

// Wikipedia answers: by-name search results, then the articles around the pin.
function stubWikipedia(byName: Page[], around: Page[] = []) {
  const fetch = vi.fn(async (url: string) => new Response(JSON.stringify({ query: { pages: url.includes("generator=search") ? byName : around } })));
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

const bayside = { name: "Bayside Marketplace", lat: 25.7782, lng: -80.1871 };
const article = (title: string, lat: number, lon: number): Page => ({
  title,
  fullurl: `https://en.wikipedia.org/wiki/${title}`,
  thumbnail: { source: `https://upload.wikimedia.org/${title}.jpg` },
  coordinates: [{ lat, lon }],
});

describe("findPhoto", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("takes the article found by name when it is near the pin", async () => {
    stubWikipedia([article("Bayside_Marketplace", 25.778, -80.187)]);
    expect(await findPhoto(bayside)).toEqual({
      photo: "https://upload.wikimedia.org/Bayside_Marketplace.jpg",
      photoPage: "https://en.wikipedia.org/wiki/Bayside_Marketplace",
    });
  });

  it("ignores a namesake far away, and nearby articles about something else", async () => {
    stubWikipedia([article("Bayside_Marketplace", 40.7, -74.0)], [article("Freedom_Tower", 25.78, -80.19)]);
    expect(await findPhoto(bayside)).toBeNull();
  });

  it("accepts a nearby article that shares a distinctive word", async () => {
    stubWikipedia([], [article("Bayside_(Miami)", 25.779, -80.188)]);
    expect((await findPhoto(bayside))?.photoPage).toBe("https://en.wikipedia.org/wiki/Bayside_(Miami)");
  });

  it("doesn't match on generic words like 'street'", async () => {
    stubWikipedia([], [article("West_Hill_Street", 25.078, -77.343)]);
    expect(await findPhoto({ name: "Bay Street", lat: 25.0781, lng: -77.3431 })).toBeNull();
  });
});

describe("withPhotos", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("searches each spot once, marks misses and keeps existing photos", async () => {
    const fetch = stubWikipedia([article("Bayside_Marketplace", 25.778, -80.187)]);
    const place = (extra: Partial<EventPlace> = {}): EventPlace => ({ key: "k", kind: "place", ...bayside, ...extra });
    const out = await withPhotos({ a: place(), b: place(), c: place({ photo: "https://x/kept.jpg" }), d: { key: "x", kind: "ship" } });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(out.a.photo).toBe("https://upload.wikimedia.org/Bayside_Marketplace.jpg");
    expect(out.b.photoPage).toBe("https://en.wikipedia.org/wiki/Bayside_Marketplace");
    expect(out.c.photo).toBe("https://x/kept.jpg");
    expect(out.d.photo).toBeUndefined();
  });
});
