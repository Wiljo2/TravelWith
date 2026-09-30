import { describe, it, expect } from "vitest";
import { initialDays } from "@/data/initialDays";
import { tripPlaces } from "./places";
import {
  canonicalUrl, classifyIdea, classifyIdeaFields, detectPlatform, findIdeaUrls, placeIndex, seedPlaces, suggestPlace, suggestType,
} from "./ideas";

describe("detectPlatform", () => {
  it("recognizes the supported networks", () => {
    expect(detectPlatform("https://www.tiktok.com/@a/video/123")).toBe("tiktok");
    expect(detectPlatform("https://vm.tiktok.com/ZMabc/")).toBe("tiktok");
    expect(detectPlatform("https://www.instagram.com/reel/Cxyz/")).toBe("instagram");
    expect(detectPlatform("https://youtu.be/abc")).toBe("youtube");
    expect(detectPlatform("https://example.com/x")).toBe("other");
    expect(detectPlatform("not a url")).toBe("other");
    expect(detectPlatform("https://eviltiktok.com/@a/video/1")).toBe("other");
    expect(detectPlatform("https://tiktok.com.evil.io/x")).toBe("other");
  });
});

describe("findIdeaUrls", () => {
  it("extracts several links from pasted chat text, with or without scheme", () => {
    const text = "Miren esto 👉 https://vm.tiktok.com/ZMabc/ y también instagram.com/reel/Cxyz?igsh=1\nhttps://youtu.be/q1";
    expect(findIdeaUrls(text)).toEqual([
      "https://vm.tiktok.com/ZMabc/",
      "https://instagram.com/reel/Cxyz?igsh=1",
      "https://youtu.be/q1",
    ]);
  });
});

describe("canonicalUrl", () => {
  it("ignores tracking params, www and trailing slash", () => {
    expect(canonicalUrl("https://www.instagram.com/reel/Cxyz/?igsh=abc"))
      .toBe(canonicalUrl("https://instagram.com/reel/Cxyz"));
  });
});

describe("seedPlaces", () => {
  it("derives the trip's places from day subtitles and the destination", () => {
    expect(seedPlaces("Florida & Bahamas", initialDays)).toEqual([
      "Orlando", "Universal Studios Orlando", "Miami", "Crucero", "Nassau", "Bahamas", "CocoCay", "Florida",
    ]);
  });

  it("works for a fresh trip with empty subtitles", () => {
    expect(seedPlaces("Cartagena, San Andrés", [])).toEqual(["Cartagena", "San Andrés"]);
  });
});

describe("suggestPlace", () => {
  const places = tripPlaces("Florida & Bahamas", initialDays);

  it("prefers the most specific place", () => {
    expect(suggestPlace("vaso recargable de Universal Orlando Resort", places)).toBe("Universal Studios Orlando");
    expect(suggestPlace("Outlets en Orlando: Nike barato", places)).toBe("Orlando Premium Outlets");
    expect(suggestPlace("Secret beach in Nassau Bahamas", places)).toBe("Nassau");
    expect(suggestPlace("Tips para el waterpark de CocoCay", places)).toBe("CocoCay");
  });

  it("maps cruise vocabulary to the cruise", () => {
    expect(suggestPlace("Todo lo que puedes hacer a bordo del barco", places)).toBe("Crucero");
  });

  it("stays quiet without a named place", () => {
    expect(suggestPlace("POV: vacaciones perfectas 🌴", places)).toBeUndefined();
  });
});

describe("suggestType", () => {
  it("detects tips, food, activities, shopping and nightlife", () => {
    expect(suggestType("Lo que muchos no saben del vaso recargable: el precio baja si compran varios")).toBe("tip");
    expect(suggestType("Restaurantes baratos en Disney Springs")).toBe("comida");
    expect(suggestType("Top 5 rides at Islands of Adventure")).toBe("actividad");
    expect(suggestType("Outlets en Orlando: dónde comprar Nike")).toBe("compras");
    expect(suggestType("Rooftop bar con vista increíble 🍸")).toBe("noche");
  });

  it("returns nothing for vague captions", () => {
    expect(suggestType("POV: vacaciones perfectas 🌴✨")).toBeUndefined();
  });
});

describe("classifyIdea", () => {
  const index = placeIndex(tripPlaces("Florida & Bahamas", initialDays), initialDays);
  const profiles = index.profiles;

  it("files the real Universal refillable-cup TikTok as a Universal tip", () => {
    const caption = "🫡 Lo que muchos no saben del vaso recargable de Universal Orlando Resort. ✔️Lo encuentran en los 4 " +
      "parques con distintos diseños: Universal Studios, Islands of Adventure, Epic Universe y Volcano Bay, y sirve " +
      "para las máquinas de Coca Cola Freestyle con +100 tipos de bebidas y sabores diferentes. ✔️El precio baja si " +
      "compran en cantidad: 1 x $19.99, 2 x $17.99, de 3 a 6 por $15.99 c/u.";
    expect(classifyIdea(caption, index)).toEqual({ place: "Universal Studios Orlando", cat: "tip" });
  });

  it("uses the itinerary's vocabulary when no place is named", () => {
    expect(classifyIdea("rooftop con tragos en Brickell", index)).toEqual({ place: "Miami", cat: "noche" });
  });

  it("falls back to hashtags and the transcript when the caption is vague", () => {
    const fields = {
      title: "🫡 no sabían esto 😱",
      tags: ["viaje", "viajes", "orlando", "universalorlandoresort", "vaso recargable disney"],
      transcript: "esto es lo que muchos no saben del vaso recargable de Universal este vaso lo pueden conseguir en " +
        "distintos diseños en los 4 parques de Universal Orlando comprando uno el precio es de 19 90",
    };
    expect(classifyIdeaFields(fields, index)).toEqual({ place: "Universal Studios Orlando", cat: "tip" });
  });

  it("lets the member's note win over the video's text", () => {
    const fields = { note: "cena en Miami", title: "tips de Universal", transcript: "Universal Orlando parques" };
    expect(classifyIdeaFields(fields, index)).toEqual({ place: "Miami", cat: "comida" });
  });

  it("assigns an activity to the place it names, not to every place of its day", () => {
    expect(profiles["Miami"].some((t) => t.includes("Brickell"))).toBe(true);
    expect(profiles["Orlando"].some((t) => t.includes("Brickell"))).toBe(false);
  });
});

describe("itinerary venues as places", () => {
  const index = placeIndex(tripPlaces("Florida & Bahamas", initialDays), initialDays);
  const place = (text: string) => classifyIdea(text, index).place;

  it("files videos under the specific spot of the plan", () => {
    expect(place("Qué comprar en Orlando Premium Outlets")).toBe("Orlando Premium Outlets");
    expect(place("Los mejores descuentos de Nike en los outlets de Orlando")).toBe("Orlando Premium Outlets");
    expect(place("helados en Disney Springs")).toBe("Disney Springs");
    expect(place("el mejor sushi de South Beach")).toBe("South Beach");
    expect(place("Rooftop en Miami Beach")).toBe("South Beach");
    expect(place("hogsmeade y la cerveza de mantequilla")).toBe("Islands of Adventure / Wizarding World");
    expect(place("tips para el embarque de Royal Caribbean")).toBe("Embarque del crucero");
    expect(place("snorkel en Royal Beach Club")).toBe("Royal Beach Club / Pearl Island");
    expect(place("Hideaway Beach vale la pena?")).toBe("Hideaway Beach");
  });

  it("keeps the area when the video covers several of its spots", () => {
    expect(place("Universal Studios, Islands of Adventure y Epic Universe en un día")).toBe("Universal Studios Orlando");
  });

  it("keeps general cruise and city videos at the area", () => {
    expect(place("Todo lo que puedes hacer a bordo del barco")).toBe("Crucero");
    expect(place("cena en Miami")).toBe("Miami");
  });
});

describe("classifyIdeaFields with TikTok's search keywords", () => {
  const index = placeIndex(tripPlaces("Florida & Bahamas", initialDays), initialDays);

  it("follows what the video is about, not a passing mention or TikTok's suggestions", () => {
    // Real TikTok (vt.tiktok.com/ZSbBtfuuk): an outlets video tagged #universal.
    const fields = {
      title: "¡Los Outlets que nadie conoce! Encontré de casualidad una mina de oro o de descuentos 🤭 si vas de shopping en " +
        "Orlando y eres deportista este lugar es para ti. #outletorlando #outlet #shoppingorlando #universal #disney",
      tags: ["outletorlando", "outlet", "shoppingorlando", "universal", "disney", "orlando outlet marketplace", "outlets orlando",
        "universal studios orlando", "orlando international premium outlets", "Universal Studios", "orlando", "ross orlando"],
      transcript: "estos son los outlets para la gente que hace deporte en Orlando 80% de descuento Adidas Nike Puma muy cerca a " +
        "los parques de universal encontré de casualidad este lugar entre el Ross y los premium outlets que siempre vamos",
    };
    expect(classifyIdeaFields(fields, index)).toEqual({ place: "Orlando Premium Outlets", cat: "compras" });
  });
});
