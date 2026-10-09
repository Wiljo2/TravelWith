import type { ActivityEntry } from "@/types";

const ITEM: Record<string, string> = {
  trip_days: "el día",
  trip_events: "la actividad",
  trip_day_spans: "el rango del día",
  trip_spans: "el rango del viaje",
  trip_expenses: "el gasto",
  trip_tasks: "el pendiente",
  trip_task_options: "la opción",
  trip_travelers: "al viajero",
  trip_documents: "el documento",
  trip_ideas: "la idea",
  trip_event_places: "el lugar en el mapa de",
};

const FIELD: Record<string, string> = {
  title: "título", label: "nombre", name: "nombre", note: "nota", sub: "subtítulo",
  start_hour: "hora", end_hour: "hora", day_id: "día", cat: "categoría",
  amount: "monto", currency: "moneda", split_mode: "reparto",
  linked_event_id: "actividad vinculada", start_day_id: "días", end_day_id: "días",
  done: "estado", priority: "prioridad", task_id: "pendiente",
  maps_url: "link de Maps", document_id: "documento", drive_file_id: "archivo", kind: "tipo",
  data: "detalles", bg: "color", border: "color", start_event_id: "inicio", end_event_id: "fin",
  flexible: "flexible", z_index: "orden",
};

const VERB: Record<ActivityEntry["op"], string> = { INSERT: "agregó", UPDATE: "editó", DELETE: "borró" };

// "Ana editó la actividad “Museo” (nota, hora)"
export function activitySentence(e: ActivityEntry): string {
  const who = e.userName ?? "Alguien";
  const item = ITEM[e.table] ?? "un elemento";
  const name = e.label ? ` “${e.label}”` : "";
  const fields = [...new Set(e.fields.map((f) => FIELD[f] ?? f))];
  const detail = e.op === "UPDATE" && fields.length ? ` (${fields.join(", ")})` : "";
  if (e.table === "trip_tasks" && e.op === "UPDATE" && e.fields.length === 1 && e.fields[0] === "done") {
    return `${who} marcó el pendiente${name}`;
  }
  return `${who} ${VERB[e.op]} ${item}${name}${detail}`;
}

// Entries grouped under "Hoy", "Ayer" or the date, in the order received.
export function groupByDay(entries: ActivityEntry[], now = new Date()): { day: string; entries: ActivityEntry[] }[] {
  const key = (d: Date) => d.toLocaleDateString("es-CO", { year: "numeric", month: "2-digit", day: "2-digit" });
  const today = key(now);
  const yesterday = key(new Date(now.getTime() - 86_400_000));
  const groups: { day: string; entries: ActivityEntry[] }[] = [];
  for (const e of entries) {
    const d = new Date(e.at);
    const k = key(d);
    const day = k === today ? "Hoy" : k === yesterday ? "Ayer" : d.toLocaleDateString("es-CO", { weekday: "short", day: "numeric", month: "short" });
    const last = groups[groups.length - 1];
    if (last?.day === day) last.entries.push(e);
    else groups.push({ day, entries: [e] });
  }
  return groups;
}

export function activityTime(at: string): string {
  return new Date(at).toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" });
}
