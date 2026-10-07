import { useState, useMemo, useCallback } from "react";
import { uid } from "@/utils/uid";
import type { Day, CalendarEvent, DaySpan, TripSpan } from "@/types";
import { DEFAULT_EVENT_CAT } from "@/constants/categories";
import { HOUR_END, HOUR_START } from "@/constants/time";
import { applyToDays, applyToList, rowToTripSpan, type Row, type TripTable } from "@/utils/tripRows";
import type { SendOp } from "@/hooks/useTripOps";
import { sendable } from "@/lib/opQueue";

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

export function useItinerary(send: SendOp) {
  const [days, setDays] = useState<Day[]>([]);
  const [tripSpans, setTripSpans] = useState<TripSpan[]>([]);
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
    const id = selectedEvent.ev.id;
    setDays((prev) =>
      prev.map((d) =>
        d.id === selectedEvent.dayId ? { ...d, events: d.events.map((e) => (e.id === id ? { ...e, ...patch } : e)) } : d,
      ),
    );
    // Hours are edited one at a time; send them together once the range is valid.
    const { start: _start, end: _end, ...rest } = patch;
    const merged = { ...selectedEvent.ev, ...patch };
    const hoursChanged = patch.start !== undefined || patch.end !== undefined;
    const validHours = merged.start >= HOUR_START && merged.end <= HOUR_END && merged.end > merged.start;
    const args = sendable({ id, ...rest, ...(hoursChanged && validHours ? { start: merged.start, end: merged.end } : {}) });
    if (args) send("event.update", args);
  }

  // The database also removes cross-day spans anchored to the event and
  // unlinks its expenses; spans are dropped here right away.
  function deleteEvent() {
    if (!selectedEvent) return;
    const id = selectedEvent.ev.id;
    setDays((prev) => prev.map((d) => (d.id === selectedEvent.dayId ? { ...d, events: d.events.filter((e) => e.id !== id) } : d)));
    setTripSpans((prev) => prev.filter((s) => s.startEventId !== id && s.endEventId !== id));
    setSelectedId(null);
    send("event.delete", { id });
  }

  // mapsUrl stays client-side until the trip tables store it (relational plan, step 3.13).
  function addEvent(dayId: string, title: string, start: number, end: number, note = "", cat = DEFAULT_EVENT_CAT, mapsUrl?: string, id = uid()) {
    const nev: CalendarEvent = { id, start, end, title, cat, note, ...(mapsUrl ? { mapsUrl } : {}) };
    setDays((prev) => prev.map((d) => (d.id === dayId ? { ...d, events: [...d.events, nev] } : d)));
    setSelectedId(nev.id);
    send("event.create", { id, dayId, title, start, end, note, cat });
    return nev.id;
  }

  // Swap the whole contents (events + day-level spans) between two days, keeping
  // each day's own label/date. Callers also remap scheduled tasks' dayId.
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
    send("day.swap", { a: aId, b: bId });
    // The subtitle describes the contents, so it moves with them.
    const a = days.find((d) => d.id === aId);
    const b = days.find((d) => d.id === bId);
    if (a && b && a.sub !== b.sub) {
      send("day.update", { id: aId, sub: b.sub ?? "" });
      send("day.update", { id: bId, sub: a.sub ?? "" });
    }
  }

  function setDaySub(dayId: string, sub: string) {
    setDays((prev) => prev.map((d) => (d.id === dayId ? { ...d, sub } : d)));
    send("day.update", { id: dayId, sub });
  }

  // newStart is already snapped and clamped by the caller
  function moveEvent(fromDayId: string, toDayId: string, ev: CalendarEvent, newStart: number) {
    if (!Number.isFinite(newStart)) return;
    const newEnd = newStart + (ev.end - ev.start);
    setDays((prev) =>
      prev.map((d) => {
        let result = d;
        if (result.id === fromDayId) result = { ...result, events: result.events.filter((x) => x.id !== ev.id) };
        if (result.id === toDayId) result = { ...result, events: [...result.events, { ...ev, start: newStart, end: newEnd }] };
        return result;
      }),
    );
    setSelectedId(ev.id);
    send("event.move", { id: ev.id, dayId: toDayId, start: newStart, end: newEnd });
  }

  const loadItinerary = useCallback((incoming: Day[], spans: TripSpan[] | undefined) => {
    if (Array.isArray(incoming) && incoming.length > 0) setDays(dedupeEventIds(incoming));
    if (Array.isArray(spans)) setTripSpans(spans);
  }, []);

  // Clears the calendar; the server regenerates the days (owner only) and
  // the caller refetches the trip afterwards.
  function resetItinerary(regenerated: Day[]) {
    setDays(regenerated);
    setTripSpans([]);
    send("itinerary.reset", {});
  }

  function addDaySpan(dayId: string, span: DaySpan) {
    setDays((prev) => prev.map((d) => (d.id === dayId ? { ...d, spans: [...(d.spans ?? []), span] } : d)));
    send("daySpan.create", { ...span, dayId });
  }

  function removeDaySpan(dayId: string, spanId: string) {
    setDays((prev) => prev.map((d) => (d.id === dayId ? { ...d, spans: (d.spans ?? []).filter((s) => s.id !== spanId) } : d)));
    send("daySpan.delete", { id: spanId });
  }

  function updateDaySpan(dayId: string, spanId: string, patch: Partial<DaySpan>) {
    setDays((prev) =>
      prev.map((d) => (d.id === dayId ? { ...d, spans: (d.spans ?? []).map((s) => (s.id === spanId ? { ...s, ...patch } : s)) } : d)),
    );
    const args = sendable({ id: spanId, ...patch });
    if (args) send("daySpan.update", args);
  }

  function addTripSpan(span: TripSpan) {
    setTripSpans((p) => [...p, span]);
    send("tripSpan.create", { ...span });
  }

  function removeTripSpan(id: string) {
    setTripSpans((p) => p.filter((s) => s.id !== id));
    send("tripSpan.delete", { id });
  }

  function updateTripSpan(id: string, patch: Partial<TripSpan>) {
    setTripSpans((p) => p.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    const args = sendable({ id, ...patch });
    if (args) send("tripSpan.update", args);
  }

  const applyRow = useCallback((table: TripTable, id: string, row: Row | null) => {
    if (table === "trip_spans") setTripSpans((prev) => applyToList(prev, id, row, rowToTripSpan));
    else setDays((prev) => applyToDays(prev, table, id, row));
  }, []);

  return {
    days, tripSpans, selectedId, selectedEvent, setSelectedId,
    updateEvent, deleteEvent, addEvent, moveEvent, swapDays, setDaySub, loadItinerary, resetItinerary,
    addDaySpan, removeDaySpan, updateDaySpan, addTripSpan, removeTripSpan, updateTripSpan, applyRow,
  };
}
