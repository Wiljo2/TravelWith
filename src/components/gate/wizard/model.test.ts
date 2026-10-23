import { describe, it, expect } from "vitest";
import { INITIAL_ANSWERS, votedKinds, wizardTrip, type WizardAnswers } from "./model";

const dated: WizardAnswers = {
  ...INITIAL_ANSWERS,
  destination: " Cartagena ",
  startDate: "2026-12-04",
  endDate: "2026-12-06",
  companion: "amigos",
  people: 3,
  resolved: ["vuelos"],
};

describe("wizardTrip", () => {
  it("sends the dates, destination, travelers and booking tasks", () => {
    expect(wizardTrip(dated, " Cartagena con amigos · Dic 2026 ")).toEqual({
      name: "Cartagena con amigos · Dic 2026",
      destination: "Cartagena",
      startDate: "2026-12-04",
      endDate: "2026-12-06",
      travelers: ["Viajero 2", "Viajero 3"],
      tasks: [{ title: "Reservar alojamiento", cat: "reservar", priority: "alta" }],
    });
  });

  it("sends no dates and opens the votes the group will settle", () => {
    const trip = wizardTrip({ ...dated, destination: "", voteDestination: true, startDate: "", endDate: "", voteDates: true }, "Mi viaje con amigos");
    expect(trip).not.toHaveProperty("startDate");
    expect(trip).not.toHaveProperty("endDate");
    expect(trip.destination).toBeUndefined();
    expect(trip.tasks).toEqual([
      { title: "¿Cuándo viajamos?", cat: "decidir", decides: "dates" },
      { title: "¿A dónde vamos?", cat: "decidir", decides: "destination" },
      { title: "Reservar alojamiento", cat: "reservar", priority: "alta" },
    ]);
  });

  it("drops a destination typed before choosing to vote on it", () => {
    expect(wizardTrip({ ...dated, voteDestination: true }, "Mi viaje").destination).toBeUndefined();
  });
});

describe("votedKinds", () => {
  it("lists what is left to a vote", () => {
    expect(votedKinds(INITIAL_ANSWERS)).toEqual([]);
    expect(votedKinds({ voteDates: true, voteDestination: false })).toEqual(["dates"]);
    expect(votedKinds({ voteDates: true, voteDestination: true })).toEqual(["dates", "destination"]);
  });
});
