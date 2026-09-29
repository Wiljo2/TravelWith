import { describe, it, expect } from "vitest";
import { initialDays } from "@/data/initialDays";
import { freeSlots, matchIdeasToPlan, snippet } from "./ideaPlan";
import { placesOfDay, tripPlaces } from "./places";
import type { Idea } from "@/types";

const places = tripPlaces("Florida & Bahamas", initialDays);
const idea = (id: string, fields: Partial<Idea>): Idea => ({
  id, url: `https://x/${id}`, platform: "instagram", createdAt: "2026-01-01T00:00:00Z", ...fields,
});
const eventTitle = (dayId: string, eventId?: string) =>
  initialDays.find((d) => d.id === dayId)?.events.find((e) => e.id === eventId)?.title;

describe("freeSlots", () => {
  it("finds gaps of 1.5 h or more between 9 am and 10 pm", () => {
    const day = { id: "x", label: "", sub: "", flexible: false, events: [
      { id: "a", start: 9, end: 11, title: "", cat: "", note: "" },
      { id: "b", start: 15, end: 16, title: "", cat: "", note: "" },
    ] };
    expect(freeSlots(day)).toEqual([{ start: 11, end: 15 }, { start: 16, end: 22 }]);
  });
});

describe("placesOfDay", () => {
  it("lists a day's areas and the venues visited that day", () => {
    expect(placesOfDay(initialDays[3], places)).toEqual(["Orlando", "Miami", "Bayside Marketplace"]);
  });
});

describe("snippet", () => {
  it("returns the words around the match", () => {
    expect(snippet("uno dos tres cuatro outlets cinco seis", "outlets", 2)).toBe("…tres cuatro outlets cinco seis");
  });
});

describe("matchIdeasToPlan", () => {
  it("links an outlets shopping video to the outlets visit", () => {
    const links = matchIdeasToPlan(
      [idea("i1", { note: "qué comprar en los outlets de Orlando", cat: "compras", place: "Orlando" })],
      initialDays, places,
    );
    expect(links).toHaveLength(1);
    expect(eventTitle(links[0].dayId, links[0].eventId)).toBe("Orlando Premium Outlets");
  });

  it("links a Disney Springs food video to both Disney Springs meals", () => {
    const links = matchIdeasToPlan([idea("i2", { note: "helados en Disney Springs", cat: "comida" })], initialDays, places);
    expect(links.map((l) => eventTitle(l.dayId, l.eventId)).sort())
      .toEqual(["Almuerzo en Disney Springs", "Cena Disney Springs"]);
  });

  it("uses the transcript and quotes it as the reason", () => {
    const links = matchIdeasToPlan([idea("i3", {
      platform: "tiktok", title: "no sabían esto 😱", place: "Universal Studios Orlando",
      transcript: "si van a Hogsmeade prueben la cerveza de mantequilla congelada es la mejor",
    })], initialDays, places);
    expect(eventTitle(links[0].dayId, links[0].eventId)).toBe("Islands of Adventure — Wizarding World");
    expect(links[0].reason).toContain("Hogsmeade");
  });

  it("matches a beach idea to the day's beach excursion", () => {
    const links = matchIdeasToPlan([idea("i4", { note: "playa escondida", place: "Nassau", cat: "actividad" })], initialDays, places);
    expect(eventTitle(links[0].dayId, links[0].eventId)).toBe("Royal Beach Club / Pearl Island");
  });

  it("suggests a free gap when no activity fits the place", () => {
    const links = matchIdeasToPlan([idea("i7", { note: "ron artesanal", place: "Nassau" })], initialDays, places);
    expect(links).toEqual([{ ideaId: "i7", dayId: "d6", slot: { start: 17.5, end: 20 }, source: "rules" }]);
  });

  it("skips ideas it can't place and discarded ones", () => {
    expect(matchIdeasToPlan([
      idea("i5", { note: "POV: vacaciones perfectas" }),
      idea("i6", { note: "outlets", place: "Orlando", status: "discarded" }),
    ], initialDays, places)).toEqual([]);
  });
});

describe("matchIdeasToPlan ignores place names as activity evidence", () => {
  it("sends a cruise pool party to the ship's pool, not to the port check-in", () => {
    const links = matchIdeasToPlan([idea("c1", { note: "fiesta en la piscina del crucero", place: "Crucero", cat: "noche" })], initialDays, places);
    expect(links.map((l) => eventTitle(l.dayId, l.eventId))).toEqual(["Piscina / cubierta superior"]);
  });

  it("matches a Nassau beach idea to the beach club, not to the docking", () => {
    const links = matchIdeasToPlan([idea("n1", { note: "snorkel y playa en Nassau", place: "Nassau", cat: "actividad" })], initialDays, places);
    expect(eventTitle(links[0].dayId, links[0].eventId)).toBe("Royal Beach Club / Pearl Island");
  });
});

describe("matchIdeasToPlan with itinerary venues", () => {
  it("sends a venue's idea to that venue's activities, preferring its kind", () => {
    const outlets = matchIdeasToPlan([idea("v1", { note: "descuentos", place: "Orlando Premium Outlets" })], initialDays, places);
    expect(outlets.map((l) => eventTitle(l.dayId, l.eventId))).toEqual(["Orlando Premium Outlets"]);
    const food = matchIdeasToPlan([idea("v2", { note: "helados", place: "Disney Springs", cat: "comida" })], initialDays, places);
    expect(food.map((l) => eventTitle(l.dayId, l.eventId)).sort()).toEqual(["Almuerzo en Disney Springs", "Cena Disney Springs"]);
  });

  it("uses the embarkation check-in for boarding tips", () => {
    const links = matchIdeasToPlan([idea("v3", { note: "qué llevar en la maleta de mano", place: "Embarque del crucero", cat: "tip" })], initialDays, places);
    expect(eventTitle(links[0].dayId, links[0].eventId)).toMatch(/Check-in puerto/);
  });
});
