import { useState, useMemo } from "react";
import { uid } from "@/utils/uid";
import { HOUR_START, HOUR_END } from "@/constants/time";
import type { Day, CalendarEvent } from "@/types";
import { DEFAULT_EVENT_CAT } from "@/constants/categories";

// Repairs payloads saved before ids were globally unique: the legacy counter
// restarted at 0 each session, so older rooms can hold repeated event ids.
function dedupeEventIds(incoming: Day[]): Day[] {
  const seen = new Set<string>();
  let changed = false;
  const result = incoming.map((d) => ({
    ...d,
    events: (d.events ?? []).map((e) => {
      if (!seen.has(e.id)) {
        seen.add(e.id);
        return e;
      }
      changed = true;
      const id = uid();
      seen.add(id);
      return { ...e, id };
    }),
  }));
  return changed ? result : incoming;
}

export function useItinerary(): {
  days: Day[];
  selectedId: string | null;
  selectedEvent: { ev: CalendarEvent; dayId: string } | null;
  setSelectedId: (id: string | null) => void;
  updateEvent: (patch: Partial<CalendarEvent>) => void;
  deleteEvent: () => void;
  addEvent: (dayId: string, title: string, start: number, end: number, note?: string, cat?: string) => string;
  moveEvent: (fromDayId: string, toDayId: string, ev: CalendarEvent, newStart: number) => void;
  swapDays: (aId: string, bId: string) => void;
  setDaySub: (dayId: string, sub: string) => void;
  loadDays: (days: Day[]) => void;
  addDaySpan: (dayId: string, span: import("../types").DaySpan) => void;
  removeDaySpan: (dayId: string, spanId: string) => void;
  updateDaySpan: (dayId: string, spanId: string, patch: Partial<import("../types").DaySpan>) => void;
} {
  const [days, setDays] = useState<Day[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedEvent = useMemo(() => {
    for (const d of days) {
      const ev = d.events.find((e) => e.id === selectedId);
      if (ev) return { ev, dayId: d.id };
    }
    return null;
  }, [days, selectedId]);

  function updateEvent(patch: Partial<CalendarEvent>) {
    if (!selectedEvent) return;
    setDays((prev) =>
      prev.map((d) =>
        d.id === selectedEvent.dayId
          ? { ...d, events: d.events.map((e) => (e.id === selectedEvent.ev.id ? { ...e, ...patch } : e)) }
          : d
      )
    );
  }

  function deleteEvent() {
    if (!selectedEvent) return;
    setDays((prev) =>
      prev.map((d) =>
        d.id === selectedEvent.dayId
          ? { ...d, events: d.events.filter((e) => e.id !== selectedEvent.ev.id) }
          : d
      )
    );
    setSelectedId(null);
  }

  function addEvent(dayId: string, title: string, start: number, end: number, note = "", cat = DEFAULT_EVENT_CAT) {
    const nev: CalendarEvent = { id: uid(), start, end, title, cat, note };
    setDays((prev) => prev.map((d) => (d.id === dayId ? { ...d, events: [...d.events, nev] } : d)));
    setSelectedId(nev.id);
    return nev.id;
  }

  // Swap the whole contents (events + day-level spans + the subtitle describing
  // them) between two days, keeping each day's own label/date. Event ids don't change, so trip-level spans still
  // resolve. Callers also remap scheduled tasks' dayId (tasks live outside here).
  function swapDays(aId: string, bId: string) {
    if (aId === bId) return;
    setDays((prev) => {
      const a = prev.find((d) => d.id === aId);
      const b = prev.find((d) => d.id === bId);
      if (!a || !b) return prev;
      return prev.map((d) => {
        if (d.id === aId) return { ...d, sub: b.sub, events: b.events, spans: b.spans };
        if (d.id === bId) return { ...d, sub: a.sub, events: a.events, spans: a.spans };
        return d;
      });
    });
  }

  // newStart is already snapped and clamped by the caller
  function moveEvent(fromDayId: string, toDayId: string, ev: CalendarEvent, newStart: number) {
    if (!Number.isFinite(newStart)) return;
    const dur = ev.end - ev.start;
    const newEnd = newStart + dur;

    setDays((prev) =>
      prev.map((d) => {
        let result = d;
        if (result.id === fromDayId) {
          result = { ...result, events: result.events.filter((x) => x.id !== ev.id) };
        }
        if (result.id === toDayId) {
          result = { ...result, events: [...result.events, { ...ev, start: newStart, end: newEnd }] };
        }
        return result;
      })
    );
    setSelectedId(ev.id);
  }

  function setDaySub(dayId: string, sub: string) {
    setDays((prev) => prev.map((d) => (d.id === dayId ? { ...d, sub } : d)));
  }

  function loadDays(incoming: Day[]) {
    if (Array.isArray(incoming) && incoming.length > 0) setDays(dedupeEventIds(incoming));
  }

  function addDaySpan(dayId: string, span: import("../types").DaySpan) {
    setDays((prev) => prev.map((d) => d.id === dayId ? { ...d, spans: [...(d.spans ?? []), span] } : d));
  }

  function removeDaySpan(dayId: string, spanId: string) {
    setDays((prev) => prev.map((d) => d.id === dayId ? { ...d, spans: (d.spans ?? []).filter((s) => s.id !== spanId) } : d));
  }

  function updateDaySpan(dayId: string, spanId: string, patch: Partial<import("../types").DaySpan>) {
    setDays((prev) => prev.map((d) =>
      d.id === dayId
        ? { ...d, spans: (d.spans ?? []).map((s) => s.id === spanId ? { ...s, ...patch } : s) }
        : d
    ));
  }

  return { days, selectedId, selectedEvent, setSelectedId, updateEvent, deleteEvent, addEvent, moveEvent, swapDays, setDaySub, loadDays, addDaySpan, removeDaySpan, updateDaySpan };
}
