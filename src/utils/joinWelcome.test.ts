import { describe, expect, it } from "vitest";
import { travelersSummary, tripFacts, welcomeItems, type WelcomeData } from "@/utils/joinWelcome";
import type { CalendarEvent, RoomMember, Task, TaskDecides } from "@/types";

const EVENT: CalendarEvent = { id: "e1", start: 9, end: 10, title: "Museo del Oro", cat: "cultura", note: "" };

const vote = (decides: TaskDecides, options = 0, done = false): Task => ({
  id: `t-${decides}`,
  title: decides,
  done,
  cat: "decidir",
  decides,
  options: Array.from({ length: options }, (_, i) => ({ id: `o${i}`, label: `Opción ${i}` })),
});

const EMPTY: WelcomeData = { tasks: [], days: [], ideas: 0 };

const keys = (data: WelcomeData) => welcomeItems(data).map((i) => i.key);

describe("welcomeItems", () => {
  it("always invites to add ideas, even on an empty trip", () => {
    expect(welcomeItems(EMPTY)).toEqual([{
      key: "ideas",
      icon: "🎬",
      label: "Agrega tus ideas (TikToks, reels, links)",
      detail: "Guarda lo que viste del destino para planear juntos.",
      tab: "ideas",
    }]);
  });

  it("puts the open votes first and sends them to Inicio", () => {
    const items = welcomeItems({ ...EMPTY, tasks: [vote("destination"), vote("dates", 2)] });
    expect(items.map((i) => [i.key, i.label, i.tab])).toEqual([
      ["voteDates", "Vota las fechas", "home"],
      ["voteDestination", "Vota el destino", "home"],
      ["ideas", "Agrega tus ideas (TikToks, reels, links)", "ideas"],
    ]);
    expect(items[0].detail).toBe("2 rangos propuestos: vota con ✋ los que te sirvan.");
    expect(items[1].detail).toBe("Nadie ha propuesto destinos: propón uno.");
  });

  it("describes a single proposal and an empty dates vote", () => {
    expect(welcomeItems({ ...EMPTY, tasks: [vote("destination", 1)] })[0].detail).toBe("1 destino propuesto: vota con ✋ los que te gusten.");
    expect(welcomeItems({ ...EMPTY, tasks: [vote("dates")] })[0].detail).toBe("Nadie ha propuesto fechas: propón un rango.");
  });

  it("ignores closed votes and ordinary tasks", () => {
    const tasks: Task[] = [vote("dates", 2, true), { id: "t1", title: "Hotel", done: false, cat: "decidir", options: [{ id: "a", label: "A" }] }];
    expect(keys({ ...EMPTY, tasks })).toEqual(["ideas"]);
  });

  it("offers the itinerary only once it has activities", () => {
    expect(keys({ ...EMPTY, days: [{ events: [] }] })).toEqual(["ideas"]);
    const items = welcomeItems({ ...EMPTY, ideas: 3, days: [{ events: [] }, { events: [EVENT, EVENT] }] });
    expect(items.map((i) => [i.key, i.tab, i.detail])).toEqual([
      ["ideas", "ideas", "El grupo ya guardó 3 ideas; suma las tuyas."],
      ["itinerary", "calendar", "2 actividades planeadas."],
    ]);
    expect(welcomeItems({ ...EMPTY, ideas: 1, days: [{ events: [EVENT] }] }).map((i) => i.detail)).toEqual([
      "El grupo ya guardó 1 idea; suma las tuyas.",
      "1 actividad planeada.",
    ]);
  });

  it("lists at most three things", () => {
    const data: WelcomeData = { tasks: [vote("dates", 1), vote("destination", 1)], days: [{ events: [EVENT] }], ideas: 2 };
    expect(keys(data)).toEqual(["voteDates", "voteDestination", "ideas"]);
  });
});

describe("tripFacts", () => {
  it("formats the dates and keeps the destination", () => {
    expect(tripFacts({ name: "Cartagena", destination: " Cartagena ", startDate: "2026-11-26", endDate: "2026-12-04" }, []))
      .toEqual({ dates: "Nov 26 – Dic 4, 2026", destination: "Cartagena" });
  });

  it("says the dates are to be decided on an undated trip", () => {
    expect(tripFacts({ name: "Viaje", destination: "Lima" }, [])).toEqual({ dates: "Fechas por decidir", destination: "Lima" });
    expect(tripFacts(null, []).dates).toBe("Fechas por decidir");
  });

  it("says the destination is to be decided only while a destination vote is open", () => {
    expect(tripFacts({ name: "Viaje" }, [vote("destination")]).destination).toBe("Destino por decidir");
    expect(tripFacts({ name: "Viaje", destination: "  " }, [vote("destination", 0, true)]).destination).toBeNull();
    expect(tripFacts({ name: "Viaje" }, []).destination).toBeNull();
  });
});

describe("travelersSummary", () => {
  const member = (userId: string, name: string): RoomMember => ({ userId, name, joinedAt: "2026-10-01T00:00:00Z" });
  const roster = [member("u1", "Ana Pérez"), member("me", "Carlos Ruiz"), member("u2", "luis@mail.com")];

  it("names me first, then the others by first name", () => {
    expect(travelersSummary(roster, "me", 0)).toEqual({ title: "3 viajeros", line: "Tú, Ana y luis" });
  });

  it("adds the placeholder travelers who haven't joined", () => {
    expect(travelersSummary(roster, "me", 2)).toEqual({ title: "5 viajeros", line: "Tú, Ana y luis · 2 por unirse" });
  });

  it("counts me even before the roster lists me", () => {
    expect(travelersSummary([], "local", 0)).toEqual({ title: "1 viajero", line: "Tú" });
    expect(travelersSummary([member("u1", "Ana")], "me", 1)).toEqual({ title: "3 viajeros", line: "Tú y Ana · 1 por unirse" });
  });

  it("shortens a long roster", () => {
    const many = ["Ana", "Luis", "Sofía", "Leo", "Marta"].map((n, i) => member(`u${i}`, n));
    expect(travelersSummary(many, "me", 0)).toEqual({ title: "6 viajeros", line: "Tú, Ana y 4 más" });
  });
});
