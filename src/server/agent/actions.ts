import type { Day, Extra, RoomPayload, Task } from "@/types";
import { fmtCOP, fmtUSD } from "@/utils/currency";
import { fmtHour } from "@/utils/time";

export type ToolKind = "read" | "write" | "delete";

export const TOOL_KIND: Record<string, ToolKind> = {
  get_trip_overview: "read",
  get_day_detail: "read",
  get_budget: "read",
  get_ideas: "read",
  create_event: "write",
  update_event: "write",
  create_task: "write",
  update_task: "write",
  add_expense: "write",
  update_expense: "write",
  set_exchange_rate: "write",
  add_idea: "write",
  delete_event: "delete",
  delete_task: "delete",
  remove_expense: "delete",
};

export function toolKind(name: string): ToolKind {
  return Object.hasOwn(TOOL_KIND, name) ? TOOL_KIND[name] : "write";
}

export interface ProposedAction {
  id: string;
  name: string;
  kind: "write" | "delete";
  summary: string;
}

type Input = Record<string, unknown>;

const MAX_TITLE = 60;
const MAX_SUMMARY = 160;

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

function num(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function quoted(v: unknown): string | undefined {
  const s = str(v);
  return s ? `"${clip(s, MAX_TITLE)}"` : undefined;
}

function findEvent(trip: RoomPayload | null, id: unknown) {
  for (const day of trip?.days ?? []) {
    const ev = day.events.find((e) => e.id === id);
    if (ev) return { ev, day };
  }
  return null;
}

function findDay(trip: RoomPayload | null, id: unknown): Day | undefined {
  return trip?.days.find((d) => d.id === id);
}

function dayName(trip: RoomPayload | null, id: unknown): string {
  return findDay(trip, id)?.label ?? "día desconocido";
}

function findTask(trip: RoomPayload | null, id: unknown): Task | undefined {
  return trip?.tasks?.find((t) => t.id === id);
}

function findExtra(trip: RoomPayload | null, id: unknown): Extra | undefined {
  return trip?.extras.find((x) => x.id === id);
}

function range(start: number | undefined, end: number | undefined): string {
  if (start !== undefined && end !== undefined) return `${fmtHour(start)}–${fmtHour(end)}`;
  return fmtHour((start ?? end) as number);
}

function money(amount: number, currency: unknown): string {
  return currency === "COP" ? fmtCOP(amount) : fmtUSD(amount);
}

function splitLabel(mode: unknown): string {
  return mode === "perPerson" ? "por persona" : "por grupo";
}

function eventChanges(trip: RoomPayload | null, input: Input): string[] {
  const changes: string[] = [];
  const start = num(input.start);
  const end = num(input.end);
  if (start !== undefined || end !== undefined) changes.push(`hora ${range(start, end)}`);
  const title = quoted(input.title);
  if (title) changes.push(`título ${title}`);
  if (input.dayId !== undefined) changes.push(`mover a ${dayName(trip, input.dayId)}`);
  if (str(input.cat)) changes.push("categoría");
  if (input.note !== undefined) changes.push("nota");
  return changes;
}

function taskChanges(trip: RoomPayload | null, input: Input): string[] {
  const changes: string[] = [];
  const title = quoted(input.title);
  if (title) changes.push(`título ${title}`);
  if (typeof input.done === "boolean") changes.push(input.done ? "marcar como hecha" : "marcar como pendiente");
  if (input.unschedule === true) changes.push("quitar del calendario");
  else if (input.dayId !== undefined) changes.push(`programar ${dayName(trip, input.dayId)}`);
  const start = num(input.start);
  const end = num(input.end);
  if (input.unschedule !== true && (start !== undefined || end !== undefined)) changes.push(`hora ${range(start, end)}`);
  if (str(input.cat)) changes.push("categoría");
  if (str(input.priority)) changes.push(`prioridad ${input.priority}`);
  if (input.note !== undefined) changes.push("nota");
  return changes;
}

function expenseChanges(input: Input, current: Extra | undefined): string[] {
  const changes: string[] = [];
  const label = quoted(input.label);
  if (label) changes.push(`nombre ${label}`);
  const amount = num(input.amount);
  if (amount !== undefined) {
    const cur = input.currency ?? current?.currency;
    changes.push(`monto ${money(amount, cur)}`);
  } else if (input.currency !== undefined) changes.push(`moneda ${String(input.currency)}`);
  if (input.splitMode !== undefined) changes.push(splitLabel(input.splitMode));
  if (input.unlinkEvent === true) changes.push("desvincular actividad");
  else if (input.linkedEventId !== undefined) changes.push("vincular actividad");
  if (input.clearDayRange === true) changes.push("quitar rango de días");
  else if (input.startDayId !== undefined) changes.push("rango de días");
  return changes;
}

function withChanges(head: string, changes: string[]): string {
  return changes.length ? `${head}: ${changes.join(", ")}` : head;
}

function describe(trip: RoomPayload | null, name: string, input: Input): string {
  switch (name) {
    case "create_event": {
      const start = num(input.start);
      const end = num(input.end);
      const parts = [`Crear actividad ${quoted(input.title) ?? ""}`.trim()];
      if (input.dayId !== undefined) parts.push(dayName(trip, input.dayId));
      if (start !== undefined && end !== undefined) parts.push(range(start, end));
      return parts.join(" · ");
    }
    case "update_event": {
      const found = findEvent(trip, input.eventId);
      if (!found) return "Editar actividad (no encontrada)";
      return withChanges(`Editar actividad "${clip(found.ev.title, MAX_TITLE)}"`, eventChanges(trip, input));
    }
    case "delete_event": {
      const found = findEvent(trip, input.eventId);
      if (!found) return "Eliminar actividad (no encontrada)";
      return `Eliminar actividad "${clip(found.ev.title, MAX_TITLE)}" · ${found.day.label}`;
    }
    case "create_task": {
      const head = `Crear tarea ${quoted(input.title) ?? ""}`.trim();
      return input.dayId !== undefined ? `${head} · ${dayName(trip, input.dayId)}` : head;
    }
    case "update_task": {
      const task = findTask(trip, input.taskId);
      if (!task) return "Editar tarea (no encontrada)";
      return withChanges(`Editar tarea "${clip(task.title, MAX_TITLE)}"`, taskChanges(trip, input));
    }
    case "delete_task": {
      const task = findTask(trip, input.taskId);
      return task ? `Eliminar tarea "${clip(task.title, MAX_TITLE)}"` : "Eliminar tarea (no encontrada)";
    }
    case "add_expense": {
      const amount = num(input.amount);
      const parts = [`Agregar gasto ${quoted(input.label) ?? ""}`.trim()];
      if (amount !== undefined) parts.push(money(amount, input.currency));
      parts.push(splitLabel(input.splitMode));
      return parts.join(" · ");
    }
    case "update_expense": {
      const extra = findExtra(trip, input.extraId);
      if (!extra) return "Editar gasto (no encontrado)";
      return withChanges(`Editar gasto "${clip(extra.label, MAX_TITLE)}"`, expenseChanges(input, extra));
    }
    case "remove_expense": {
      const extra = findExtra(trip, input.extraId);
      return extra ? `Eliminar gasto "${clip(extra.label, MAX_TITLE)}"` : "Eliminar gasto (no encontrado)";
    }
    case "set_exchange_rate": {
      const rate = num(input.rate);
      return rate === undefined ? "Cambiar la TRM" : `Cambiar la TRM a ${rate.toLocaleString("es-CO")} COP por USD`;
    }
    case "add_idea": {
      const note = quoted(input.note);
      return [`Guardar idea ${clip(str(input.url) ?? "", MAX_TITLE)}`.trim(), note].filter(Boolean).join(" · ");
    }
    default:
      return `Ejecutar ${name}`;
  }
}

export function describeAction(trip: RoomPayload | null, name: string, input: Record<string, unknown>): string {
  try {
    return clip(describe(trip, name, input ?? {}), MAX_SUMMARY);
  } catch {
    return `Ejecutar ${name}`;
  }
}

export function proposedActions(
  trip: RoomPayload | null,
  toolUses: { id: string; name: string; input: unknown }[],
): ProposedAction[] {
  return toolUses.flatMap((u) => {
    const kind = toolKind(u.name);
    if (kind === "read") return [];
    const input = u.input && typeof u.input === "object" && !Array.isArray(u.input) ? (u.input as Input) : {};
    return [{ id: u.id, name: u.name, kind, summary: describeAction(trip, u.name, input) }];
  });
}
