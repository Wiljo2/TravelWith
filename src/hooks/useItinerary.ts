import { useState, useMemo } from "react";
import { initialDays } from "../data/initialDays";
import { uid } from "../utils/uid";
import { HOUR_START, HOUR_END } from "../constants/time";
import type { Day, CalendarEvent } from "../types";

export function useItinerary(): {
  days: Day[];
  selectedId: string | null;
  selectedEvent: { ev: CalendarEvent; dayId: string } | null;
  setSelectedId: (id: string | null) => void;
  updateEvent: (patch: Partial<CalendarEvent>) => void;
  deleteEvent: () => void;
  addEvent: (dayId: string) => void;
  moveEvent: (fromDayId: string, toDayId: string, ev: CalendarEvent, newStart: number) => void;
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

  function addEvent(dayId: string) {
    // HOUR_START / HOUR_END referenced to satisfy noUnusedLocals — they guard the default times
    const clampedStart = Math.max(HOUR_START, Math.min(12, HOUR_END - 1));
    const nev: CalendarEvent = { id: uid(), start: clampedStart, end: clampedStart + 1, title: "Nueva actividad", cat: "miami", note: "" };
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

  return { days, selectedId, selectedEvent, setSelectedId, updateEvent, deleteEvent, addEvent, moveEvent };
}
