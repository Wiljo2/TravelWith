import { describe, it, expect } from "vitest";
import { LIMITS } from "@/constants/limits";
import type { NewTrip } from "@/types";
import { clampPeople, placeholderTravelers, starterTasks, suggestTripName, tripHeader, voteStarterTasks } from "./tripSetup";

describe("suggestTripName", () => {
  it("joins destination, companions and the start month", () => {
    expect(suggestTripName("Cartagena", "amigos", "2026-12-04")).toBe("Cartagena con amigos · Dic 2026");
    expect(suggestTripName("Cartagena", "pareja", "2026-12-04")).toBe("Cartagena en pareja · Dic 2026");
    expect(suggestTripName("Cartagena", "familia", "2027-01-10")).toBe("Cartagena en familia · Ene 2027");
  });

  it("leaves the companions out for a solo trip or no answer", () => {
    expect(suggestTripName("Cartagena", "solo", "2026-12-04")).toBe("Cartagena · Dic 2026");
    expect(suggestTripName("Cartagena", null, "2026-12-04")).toBe("Cartagena · Dic 2026");
  });

  it("falls back to 'Mi viaje' without a destination", () => {
    expect(suggestTripName("", "amigos", "2026-12-04")).toBe("Mi viaje con amigos · Dic 2026");
    expect(suggestTripName("   ", "solo", "2026-12-04")).toBe("Mi viaje · Dic 2026");
  });

  it("omits the month without a valid start date", () => {
    expect(suggestTripName(" Cartagena ", "amigos", "")).toBe("Cartagena con amigos");
    expect(suggestTripName("Cartagena", "amigos")).toBe("Cartagena con amigos");
  });

  it("stays within the name limit and keeps the month", () => {
    const name = suggestTripName("x".repeat(LIMITS.name), "amigos", "2026-12-04");
    expect(name.length).toBeLessThanOrEqual(LIMITS.name);
    expect(name.endsWith(" · Dic 2026")).toBe(true);
  });
});

describe("placeholderTravelers", () => {
  it("names everyone but the creator", () => {
    expect(placeholderTravelers(1)).toEqual([]);
    expect(placeholderTravelers(4)).toEqual(["Viajero 2", "Viajero 3", "Viajero 4"]);
  });

  it("clamps the head count to the traveler limit plus the creator", () => {
    expect(placeholderTravelers(0)).toEqual([]);
    expect(placeholderTravelers(500)).toHaveLength(LIMITS.travelers);
    expect(clampPeople(Number.NaN)).toBe(1);
    expect(clampPeople(2.6)).toBe(3);
  });
});

describe("tripHeader", () => {
  it("keeps only the header fields, with dates when both are set", () => {
    const trip = { name: "Cartagena", destination: "Cartagena", startDate: "2026-12-04", endDate: "2026-12-06" };
    const withSeeds: NewTrip = { ...trip, travelers: ["Viajero 2"] };
    expect(tripHeader(withSeeds)).toStrictEqual(trip);
    expect(tripHeader({ name: "Cartagena", destination: "Cartagena" })).toStrictEqual({ name: "Cartagena", destination: "Cartagena" });
  });
});

describe("starterTasks", () => {
  it("adds a high-priority booking task for each item not resolved", () => {
    expect(starterTasks([])).toEqual([
      { title: "Reservar vuelos", cat: "reservar", priority: "alta" },
      { title: "Reservar alojamiento", cat: "reservar", priority: "alta" },
    ]);
    expect(starterTasks(["vuelos"])).toEqual([{ title: "Reservar alojamiento", cat: "reservar", priority: "alta" }]);
    expect(starterTasks(["vuelos", "alojamiento"])).toEqual([]);
  });
});

describe("voteStarterTasks", () => {
  it("opens one \"Por decidir\" vote per kind left to the group, dates first", () => {
    expect(voteStarterTasks([])).toEqual([]);
    expect(voteStarterTasks(["destination", "dates"])).toEqual([
      { title: "¿Cuándo viajamos?", cat: "decidir", decides: "dates" },
      { title: "¿A dónde vamos?", cat: "decidir", decides: "destination" },
    ]);
  });

  it("fits with every booking task in the starter task limit", () => {
    expect(starterTasks([]).length + voteStarterTasks(["dates", "destination"]).length).toBeLessThanOrEqual(LIMITS.starterTasks);
  });
});
