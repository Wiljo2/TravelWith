import { describe, expect, it } from "vitest";
import type { RoomPayload } from "@/types";
import { describeAction, proposedActions, toolKind } from "@/server/agent/actions";

const trip = {
  days: [
    { id: "d0", label: "Vie 13", sub: "", flexible: false, events: [{ id: "e1", title: "Museo", start: 9, end: 11 }] },
    { id: "d1", label: "Sáb 14", sub: "", flexible: false, events: [] },
  ],
  extras: [{ id: "x1", label: "Hotel", amount: 120, currency: "USD", splitMode: "group" }],
  exchangeRate: 4000,
  tasks: [{ id: "k1", title: "Comprar SIM", done: false }],
} as unknown as RoomPayload;

describe("toolKind", () => {
  it("classifies tools and fails safe on unknown names", () => {
    expect(toolKind("get_budget")).toBe("read");
    expect(toolKind("create_event")).toBe("write");
    expect(toolKind("set_exchange_rate")).toBe("write");
    expect(toolKind("remove_expense")).toBe("delete");
    expect(toolKind("drop_database")).toBe("write");
    expect(toolKind("toString")).toBe("write");
  });
});

describe("describeAction", () => {
  it("create_event", () => {
    expect(describeAction(trip, "create_event", { dayId: "d1", title: "Cena", start: 20, end: 22 })).toBe(
      'Crear actividad "Cena" · Sáb 14 · 8:00 pm–10:00 pm',
    );
  });

  it("update_event lists only changed fields", () => {
    expect(describeAction(trip, "update_event", { eventId: "e1", start: 9, end: 11, title: "Museo del Oro" })).toBe(
      'Editar actividad "Museo": hora 9:00 am–11:00 am, título "Museo del Oro"',
    );
    expect(describeAction(trip, "update_event", { eventId: "e1", dayId: "d1" })).toBe(
      'Editar actividad "Museo": mover a Sáb 14',
    );
  });

  it("delete_event", () => {
    expect(describeAction(trip, "delete_event", { eventId: "e1" })).toBe('Eliminar actividad "Museo" · Vie 13');
  });

  it("tasks", () => {
    expect(describeAction(trip, "create_task", { title: "Comprar SIM" })).toBe('Crear tarea "Comprar SIM"');
    expect(describeAction(trip, "update_task", { taskId: "k1", done: true })).toBe(
      'Editar tarea "Comprar SIM": marcar como hecha',
    );
    expect(describeAction(trip, "update_task", { taskId: "k1", dayId: "d0" })).toBe(
      'Editar tarea "Comprar SIM": programar Vie 13',
    );
    expect(describeAction(trip, "update_task", { taskId: "k1", unschedule: true })).toBe(
      'Editar tarea "Comprar SIM": quitar del calendario',
    );
    expect(describeAction(trip, "delete_task", { taskId: "k1" })).toBe('Eliminar tarea "Comprar SIM"');
  });

  it("expenses", () => {
    expect(describeAction(trip, "add_expense", { label: "Hotel", amount: 120 })).toBe(
      'Agregar gasto "Hotel" · US$120 · por grupo',
    );
    expect(describeAction(trip, "add_expense", { label: "Taxi", amount: 50000, currency: "COP", splitMode: "perPerson" })).toBe(
      'Agregar gasto "Taxi" · $50.000 COP · por persona',
    );
    expect(describeAction(trip, "update_expense", { extraId: "x1", amount: 150 })).toBe(
      'Editar gasto "Hotel": monto US$150',
    );
    expect(describeAction(trip, "remove_expense", { extraId: "x1" })).toBe('Eliminar gasto "Hotel"');
  });

  it("set_exchange_rate", () => {
    expect(describeAction(trip, "set_exchange_rate", { rate: 4100 })).toBe("Cambiar la TRM a 4.100 COP por USD");
  });

  it("falls back when ids are missing or the trip is null", () => {
    expect(describeAction(trip, "delete_event", { eventId: "nope" })).toBe("Eliminar actividad (no encontrada)");
    expect(describeAction(null, "delete_task", { taskId: "k1" })).toBe("Eliminar tarea (no encontrada)");
    expect(describeAction(trip, "update_expense", { extraId: "nope" })).toBe("Editar gasto (no encontrado)");
    expect(describeAction(null, "create_event", { dayId: "d9", title: "A", start: 1, end: 2 })).toContain("día desconocido");
  });

  it("handles unknown tools and garbage input without throwing", () => {
    expect(describeAction(trip, "mystery", {})).toBe("Ejecutar mystery");
    expect(describeAction(trip, "create_event", {})).toBe("Crear actividad");
  });

  it("truncates titles and summaries", () => {
    const long = "x".repeat(200);
    const out = describeAction(trip, "create_task", { title: long });
    expect(out).toBe(`Crear tarea "${"x".repeat(59)}…"`);
    const big = describeAction(trip, "update_event", { eventId: "e1", title: long, dayId: "d1", start: 1, end: 2, cat: "a", note: "b" });
    expect(big.length).toBeLessThanOrEqual(160);
  });
});

describe("proposedActions", () => {
  it("skips reads and keeps ids and kinds", () => {
    const out = proposedActions(trip, [
      { id: "a", name: "get_budget", input: {} },
      { id: "b", name: "delete_task", input: { taskId: "k1" } },
      { id: "c", name: "create_task", input: null },
    ]);
    expect(out).toEqual([
      { id: "b", name: "delete_task", kind: "delete", summary: 'Eliminar tarea "Comprar SIM"' },
      { id: "c", name: "create_task", kind: "write", summary: "Crear tarea" },
    ]);
  });
});
