import { HOUR_START, HOUR_END } from "@/constants/time";
import type { Day, DaySpan, TripSpan } from "@/types";

// Given all days and all trip-level spans, compute the DaySpan slices visible
// in a specific day. A span crossing N days produces a slice in each of those days.
export function resolveForDay(day: Day, allDays: Day[], tripSpans: TripSpan[]): DaySpan[] {
  const dayIdx = allDays.findIndex((d) => d.id === day.id);
  const result: DaySpan[] = [];

  for (const span of tripSpans) {
    let startDayIdx = -1, endDayIdx = -1;
    let startHour = HOUR_START, endHour = HOUR_END + 1;

    for (let i = 0; i < allDays.length; i++) {
      const s = allDays[i].events.find((e) => e.id === span.startEventId);
      if (s) { startDayIdx = i; startHour = s.start; }
      const e = allDays[i].events.find((e) => e.id === span.endEventId);
      if (e) { endDayIdx = i; endHour = e.end; }
    }

    if (startDayIdx < 0 || endDayIdx < 0) continue;         // events not found
    if (dayIdx < startDayIdx || dayIdx > endDayIdx) continue; // day outside range

    result.push({
      id: `trip-${span.id}-d${dayIdx}`,
      label: span.label,
      // First day: start at event time. Middle/last days: start at top of grid.
      startHour: dayIdx === startDayIdx ? startHour : HOUR_START,
      // Last day: end at event time. First/middle days: go to bottom of grid.
      endHour:   dayIdx === endDayIdx   ? endHour   : HOUR_END + 1,
      bg:     span.bg,
      border: span.border,
      zIndex: span.zIndex ?? 1,
    });
  }

  return result;
}

// Distinct labeled spans touching a day (static + trip-level), for compact chips.
export function daySpanLabels(day: Day, allDays: Day[], tripSpans: TripSpan[]): { label: string; color: string }[] {
  const seen = new Set<string>();
  const out: { label: string; color: string }[] = [];
  for (const s of [...(day.spans ?? []), ...resolveForDay(day, allDays, tripSpans)]) {
    if (!s.label || seen.has(s.label)) continue;
    seen.add(s.label);
    out.push({ label: s.label, color: s.border !== "transparent" ? s.border : s.bg });
  }
  return out;
}
