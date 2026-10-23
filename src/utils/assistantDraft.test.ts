import { describe, expect, it } from "vitest";
import { firstPlanDraft, spokenTripDates } from "@/utils/assistantDraft";

const TRIP = { name: "Cartagena con amigos · Dic 2026", destination: "Cartagena", startDate: "2026-12-04", endDate: "2026-12-07" };

describe("spokenTripDates", () => {
  it("names the month once inside one month", () => {
    expect(spokenTripDates("2026-12-04", "2026-12-07")).toBe("del 4 al 7 de diciembre");
  });

  it("names both months across months", () => {
    expect(spokenTripDates("2026-11-26", "2026-12-04")).toBe("del 26 de noviembre al 4 de diciembre");
  });

  it("adds the years across a new year", () => {
    expect(spokenTripDates("2026-12-28", "2027-01-03")).toBe("del 28 de diciembre de 2026 al 3 de enero de 2027");
  });

  it("speaks of a single day", () => {
    expect(spokenTripDates("2026-12-04", "2026-12-04")).toBe("el 4 de diciembre");
  });

  it("is empty without valid dates", () => {
    expect(spokenTripDates("", "2026-12-07")).toBe("");
    expect(spokenTripDates("2026-12-07", "2026-12-04")).toBe("");
    expect(spokenTripDates("2026-02-30", "2026-03-02")).toBe("");
  });
});

describe("firstPlanDraft", () => {
  it("describes a group trip and asks for a day-by-day plan", () => {
    expect(firstPlanDraft(TRIP, 4)).toBe(
      "Somos 4 y vamos a Cartagena del 4 al 7 de diciembre. Propón un primer plan día por día.",
    );
  });

  it("speaks in the first person for one traveler", () => {
    expect(firstPlanDraft(TRIP, 1)).toBe("Voy a Cartagena del 4 al 7 de diciembre. Propón un primer plan día por día.");
  });

  it("works without a destination", () => {
    const trip = { ...TRIP, destination: "  " };
    expect(firstPlanDraft(trip, 2)).toBe("Somos 2 y nos vamos de viaje del 4 al 7 de diciembre. Propón un primer plan día por día.");
    expect(firstPlanDraft({ ...trip, destination: undefined }, 1)).toBe(
      "Me voy de viaje del 4 al 7 de diciembre. Propón un primer plan día por día.",
    );
  });

  it("leaves the dates out when they are not valid", () => {
    expect(firstPlanDraft({ ...TRIP, startDate: "2026-12-07", endDate: "2026-12-04" }, 3)).toBe(
      "Somos 3 y vamos a Cartagena. Propón un primer plan día por día.",
    );
  });

  it("says the dates are still to be decided", () => {
    expect(firstPlanDraft({ name: TRIP.name, destination: "Cartagena" }, 3)).toBe(
      "Somos 3 y vamos a Cartagena, aún sin fechas (las vamos a votar). Propón un primer plan día por día.",
    );
  });

  it("trims the destination", () => {
    expect(firstPlanDraft({ ...TRIP, destination: " Cartagena " }, 4)).toContain("vamos a Cartagena del");
  });
});
