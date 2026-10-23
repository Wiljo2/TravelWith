import { describe, expect, it } from "vitest";
import { activitySentence, groupByDay } from "@/utils/activityText";
import type { ActivityEntry } from "@/types";

const entry = (over: Partial<ActivityEntry> = {}): ActivityEntry => ({
  id: 1, table: "trip_events", rowId: "e1", op: "UPDATE", at: "2026-10-09T15:00:00Z", userName: "Ana", label: "Museo", fields: ["note"], ...over,
});

describe("activity text", () => {
  it("reads like a sentence in Spanish", () => {
    expect(activitySentence(entry())).toBe("Ana editó la actividad “Museo” (nota)");
    expect(activitySentence(entry({ fields: ["start_hour", "end_hour"] }))).toBe("Ana editó la actividad “Museo” (hora)");
    expect(activitySentence(entry({ op: "INSERT", table: "trip_expenses", label: "Hotel", fields: [] }))).toBe("Ana agregó el gasto “Hotel”");
    expect(activitySentence(entry({ op: "DELETE", userName: null, label: null, fields: [] }))).toBe("Alguien borró la actividad");
    expect(activitySentence(entry({ table: "trip_tasks", label: "Tolls", fields: ["done"] }))).toBe("Ana marcó el pendiente “Tolls”");
  });

  it("tells votes apart from edits of an option", () => {
    expect(activitySentence(entry({ table: "trip_task_options", label: "Hotel A", fields: ["votes"] }))).toBe("Ana votó en la opción “Hotel A”");
    expect(activitySentence(entry({ table: "trip_task_options", label: "Hotel A", fields: ["label", "votes"] })))
      .toBe("Ana editó la opción “Hotel A” (nombre, votos)");
    expect(activitySentence(entry({ table: "trip_task_options", label: "Dic", fields: ["end_date", "start_date"] })))
      .toBe("Ana editó la opción “Dic” (fechas)");
  });

  it("groups entries by day, newest first", () => {
    const now = new Date("2026-10-09T18:00:00Z");
    const groups = groupByDay([entry({ id: 3 }), entry({ id: 2 }), entry({ id: 1, at: "2026-10-08T15:00:00Z" })], now);
    expect(groups.map((g) => [g.day, g.entries.map((e) => e.id)])).toEqual([["Hoy", [3, 2]], ["Ayer", [1]]]);
  });
});
