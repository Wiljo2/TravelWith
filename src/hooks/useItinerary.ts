import { useState, useMemo } from "react";
import { initialDays } from "@/data/initialDays";
import { uid } from "@/utils/uid";
import { HOUR_START, HOUR_END } from "@/constants/time";
import type { Day, CalendarEvent } from "@/types";

export function useItinerary(): {
  days: Day[];
  selectedId: string | null;
  selectedEvent: { ev: CalendarEvent; dayId: string } | null;
  setSelectedId: (id: string | null) => void;
  updateEvent: (patch: Partial<CalendarEvent>) => void;
  deleteEvent: () => void;
  addEvent: (dayId: string, title: string, start: number, end: number, note?: string, cat?: string) => void;
  moveEvent: (fromDayId: string, toDayId: string, ev: CalendarEvent, newStart: number) => void;
  loadDays: (days: Day[]) => void;
  addDaySpan: (dayId: string, span: import("../types").DaySpan) => void;
  removeDaySpan: (dayId: string, spanId: string) => void;
  updateDaySpan: (dayId: string, spanId: string, patch: Partial<import("../types").DaySpan>) => void;
} {
  const [days, setDays] = useState<Day[]>(initialDays);
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

  function addEvent(dayId: string, title: string, start: number, end: number, note = "", cat = "miami") {
    const nev: CalendarEvent = { id: uid(), start, end, title, cat, note };
    setDays((prev) => prev.map((d) => (d.id === dayId ? { ...d, events: [...d.events, nev] } : d)));
    setSelectedId(nev.id);
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

  function loadDays(incoming: Day[]) {
    if (Array.isArray(incoming) && incoming.length > 0) setDays(incoming);
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

  return { days, selectedId, selectedEvent, setSelectedId, updateEvent, deleteEvent, addEvent, moveEvent, loadDays, addDaySpan, removeDaySpan, updateDaySpan };
}
