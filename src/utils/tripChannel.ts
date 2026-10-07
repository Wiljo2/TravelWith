import type { Row, TripTable } from "@/utils/tripRows";

// Messages on the private Broadcast channel trip:<code>. Trip tables send
// realtime.broadcast_changes; the rooms trigger sends the header and roster
// with realtime.send. Both arrive as { event, payload: { operation, table,
// schema, record, old_record } } (shape recorded in the 0.1 spike).

export type TripMessage =
  | { kind: "row"; operation: "INSERT" | "UPDATE" | "DELETE"; table: TripTable; id: string; row: Row | null; version: number }
  | { kind: "room"; record: Record<string, unknown> }
  | { kind: "roomDeleted" };

const TRIP_TABLES = new Set<string>([
  "trip_days",
  "trip_events",
  "trip_day_spans",
  "trip_spans",
  "trip_expenses",
  "trip_tasks",
  "trip_task_options",
  "trip_travelers",
]);

const OPERATIONS = new Set(["INSERT", "UPDATE", "DELETE"]);

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

export function parseTripMessage(payload: unknown): TripMessage | null {
  if (!isObject(payload)) return null;
  const { operation, table, record, old_record: oldRecord } = payload;
  if (typeof operation !== "string" || !OPERATIONS.has(operation)) return null;

  if (table === "rooms") {
    if (operation === "DELETE") return { kind: "roomDeleted" };
    return isObject(record) ? { kind: "room", record } : null;
  }
  if (typeof table !== "string" || !TRIP_TABLES.has(table)) return null;

  const source = operation === "DELETE" ? oldRecord : record;
  if (!isObject(source) || typeof source.id !== "string") return null;
  const version = Number(source.version);
  if (!Number.isFinite(version)) return null;

  return {
    kind: "row",
    operation: operation as "INSERT" | "UPDATE" | "DELETE",
    table: table as TripTable,
    id: source.id,
    row: operation === "DELETE" ? null : (source as Row),
    version,
  };
}

// Day rows are only created in bulk (itinerary reset); the day list is
// rebuilt from a refetch instead of from single inserts.
export function needsRefetch(message: TripMessage): boolean {
  return message.kind === "row" && message.table === "trip_days" && message.operation === "INSERT";
}

// A subscribe rejected by the realtime.messages policy (not a member). The
// client would otherwise keep rejoining forever.
export function isAccessDenied(error: { message?: string } | undefined): boolean {
  return !!error?.message && /unauthorized|permission/i.test(error.message);
}
