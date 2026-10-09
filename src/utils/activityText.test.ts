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

  it("groups entries by day, newest first", () => {
    const now = new Date("2026-10-09T18:00:00Z");
    const groups = groupByDay([entry({ id: 3 }), entry({ id: 2 }), entry({ id: 1, at: "2026-10-08T15:00:00Z" })], now);
    expect(groups.map((g) => [g.day, g.entries.map((e) => e.id)])).toEqual([["Hoy", [3, 2]], ["Ayer", [1]]]);
  });
});
