import { describe, it, expect } from "vitest";
import { agendaRows } from "./agendaRows";
import type { Day, Task } from "@/types";

const day: Day = {
  id: "d0", label: "Jue · Nov 26", sub: "", flexible: false,
  events: [
    { id: "lunch", start: 13, end: 14, title: "Almuerzo", cat: "comida", note: "" },
    { id: "museum", start: 9, end: 11, title: "Museo", cat: "actividad", note: "" },
  ],
};

describe("agendaRows", () => {
  it("merges the day's activities and scheduled tasks by start time", () => {
    const tasks: Task[] = [
      { id: "tickets", title: "Comprar entradas", done: false, dayId: "d0", start: 13 },
      { id: "backlog", title: "Sin día", done: false },
      { id: "other", title: "Otro día", done: false, dayId: "d1", start: 8 },
      { id: "unscheduled", title: "Sin hora", done: false, dayId: "d0" },
    ];
    expect(agendaRows(day, tasks).map((r) => (r.kind === "event" ? r.ev.id : r.task.id))).toEqual(["museum", "lunch", "tickets"]);
  });
});
