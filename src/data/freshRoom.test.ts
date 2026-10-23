import { describe, it, expect } from "vitest";
import { freshRoomPayload } from "./freshRoom";

const trip = { name: "Cartagena con amigos · Dic 2026", destination: "Cartagena", startDate: "2026-12-04", endDate: "2026-12-06" };

describe("freshRoomPayload", () => {
  it("builds the header, the days and the wizard's travelers and tasks", () => {
    const payload = freshRoomPayload({
      ...trip,
      travelers: ["Viajero 2", "Viajero 3"],
      tasks: [{ title: "Reservar vuelos", cat: "reservar", priority: "alta" }],
    });
    expect(payload.trip).toEqual(trip);
    expect(payload.days.map((d) => d.id)).toEqual(["d0", "d1", "d2"]);
    expect(payload.mockPeople).toEqual([{ id: "mp-1", name: "Viajero 2" }, { id: "mp-2", name: "Viajero 3" }]);
    expect(payload.tasks).toEqual([{ id: "task-1", title: "Reservar vuelos", done: false, cat: "reservar", priority: "alta" }]);
  });

  it("reads trips stored before the wizard (no travelers or tasks)", () => {
    const payload = freshRoomPayload(trip);
    expect(payload.trip).toEqual(trip);
    expect(payload.mockPeople).toEqual([]);
    expect(payload.tasks).toEqual([]);
  });

  it("has no days while the dates are to be decided", () => {
    const payload = freshRoomPayload({ name: "Cartagena con amigos", destination: "Cartagena", tasks: [{ title: "Reservar vuelos" }] });
    expect(payload.trip).toStrictEqual({ name: "Cartagena con amigos", destination: "Cartagena" });
    expect(payload.days).toEqual([]);
    expect(payload.tasks).toHaveLength(1);
  });

  it("defaults to a 5-day trip a month from now", () => {
    const payload = freshRoomPayload(null, new Date(2026, 9, 22));
    expect(payload.trip).toEqual({ name: "Mi viaje", startDate: "2026-11-21", endDate: "2026-11-25" });
    expect(payload.days).toHaveLength(5);
  });
});
