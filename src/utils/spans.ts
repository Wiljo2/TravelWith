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

const spanColor = (s: { bg: string; border: string }) => (s.border !== "transparent" ? s.border : s.bg);

// Distinct labeled spans touching a day (static + trip-level), for compact chips.
export function daySpanLabels(day: Day, allDays: Day[], tripSpans: TripSpan[]): { label: string; color: string }[] {
  const seen = new Set<string>();
  const out: { label: string; color: string }[] = [];
  for (const s of [...(day.spans ?? []), ...resolveForDay(day, allDays, tripSpans)]) {
    if (!s.label || seen.has(s.label)) continue;
    seen.add(s.label);
    out.push({ label: s.label, color: spanColor(s) });
  }
  return out;
}

// A span as a run of whole days (indices into the itinerary, inclusive), for the month view.
export interface SpanRange {
  id: string;
  label?: string;
  bg: string;
  color: string;
  startIdx: number;
  endIdx: number;
}

// Trip spans resolved to the days of their start and end activities (skipped when
// either is gone or they are reversed, as in the grid), then day spans, where the
// same label and colors on consecutive days read as one range.
export function spanRanges(days: Day[], tripSpans: TripSpan[]): SpanRange[] {
  const dayOfEvent = new Map<string, number>();
  days.forEach((d, i) => d.events.forEach((e) => dayOfEvent.set(e.id, i)));

  const out: SpanRange[] = [];
  for (const s of tripSpans) {
    const startIdx = dayOfEvent.get(s.startEventId);
    const endIdx = dayOfEvent.get(s.endEventId);
    if (startIdx === undefined || endIdx === undefined || endIdx < startIdx) continue;
    out.push({ id: `trip-${s.id}`, label: s.label, bg: s.bg, color: spanColor(s), startIdx, endIdx });
  }

  const open = new Map<string, SpanRange>();
  days.forEach((d, i) => {
    for (const s of d.spans ?? []) {
      const key = `${s.label ?? ""}|${s.bg}|${s.border}`;
      const prev = open.get(key);
      if (prev?.endIdx === i) continue;
      if (prev?.endIdx === i - 1) {
        prev.endIdx = i;
        continue;
      }
      const range = { id: `day-${s.id}`, label: s.label, bg: s.bg, color: spanColor(s), startIdx: i, endIdx: i };
      open.set(key, range);
      out.push(range);
    }
  });
  return out;
}
