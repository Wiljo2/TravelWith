import { useState, useMemo } from "react";
import { initialDays } from "../data/initialDays";
import { uid } from "../utils/uid";
import { HOUR_START, HOUR_END } from "../constants/time";

export function useItinerary() {
  const [days, setDays] = useState(initialDays);
  const [selectedId, setSelectedId] = useState(null);

  const selectedEvent = useMemo(() => {
    for (const d of days) {
      const ev = d.events.find((e) => e.id === selectedId);
      if (ev) return { ev, dayId: d.id };
    }
    return null;
  }, [days, selectedId]);

  function updateEvent(patch) {
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

  function addEvent(dayId) {
    const nev = { id: uid(), start: 12, end: 13, title: "Nueva actividad", cat: "miami", note: "" };
    setDays((prev) => prev.map((d) => (d.id === dayId ? { ...d, events: [...d.events, nev] } : d)));
    setSelectedId(nev.id);
  }

  // newStart is already snapped and clamped by the caller
  function moveEvent(fromDayId, toDayId, ev, newStart) {
    if (!Number.isFinite(newStart)) return;
    const dur = ev.end - ev.start;
    const newEnd = newStart + dur;

    setDays((prev) =>
      prev.map((d) => {
        if (d.id === fromDayId) {
          d = { ...d, events: d.events.filter((x) => x.id !== ev.id) };
        }
        if (d.id === toDayId) {
          d = { ...d, events: [...d.events, { ...ev, start: newStart, end: newEnd }] };
        }
        return d;
      })
    );
    setSelectedId(ev.id);
  }

  return { days, selectedId, selectedEvent, setSelectedId, updateEvent, deleteEvent, addEvent, moveEvent };
}
