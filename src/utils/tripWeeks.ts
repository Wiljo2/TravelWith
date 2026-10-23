import { MAX_TRIP_DAYS, parseISODate } from "@/utils/tripDays";
import type { SpanRange } from "@/utils/spans";

export const WEEK_HEADERS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const DAY_MS = 86_400_000;

export interface WeekDay {
  iso: string;      // yyyy-mm-dd
  day: number;      // day of the month
  month: number;    // 0 = January
  inTrip: boolean;
  dayIdx: number;   // offset from the trip's first day (negative before it); the itinerary index when inTrip
}

const toISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const daysBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / DAY_MS);

// The Mon–Sun weeks that [startDate, endDate] touches, each date marked in or out of the trip.
// Empty for invalid or reversed dates, or a range longer than MAX_TRIP_DAYS.
export function tripWeeks(startDate: string, endDate: string): WeekDay[][] {
  const start = parseISODate(startDate);
  const end = parseISODate(endDate);
  if (!start || !end || end < start) return [];
  const length = daysBetween(start, end) + 1;
  if (length > MAX_TRIP_DAYS) return [];

  const cursor = new Date(start);
  cursor.setDate(cursor.getDate() - ((cursor.getDay() + 6) % 7));
  let offset = daysBetween(start, cursor);
  const weeks: WeekDay[][] = [];
  while (offset < length) {
    const week: WeekDay[] = [];
    for (let i = 0; i < 7; i++) {
      week.push({ iso: toISO(cursor), day: cursor.getDate(), month: cursor.getMonth(), inTrip: offset >= 0 && offset < length, dayIdx: offset });
      cursor.setDate(cursor.getDate() + 1);
      offset++;
    }
    weeks.push(week);
  }
  return weeks;
}

// True when the trip doesn't fit in a single Mon–Sun week.
export const spansSeveralWeeks = (startDate: string, endDate: string) => tripWeeks(startDate, endDate).length > 1;

// A span range cut to one week row: columns 0 (Mon) – 6 (Sun), inclusive.
export interface WeekBar {
  id: string;
  label?: string;
  bg: string;
  color: string;
  startCol: number;
  endCol: number;
  lane: number;
  continuesBefore: boolean;
  continuesAfter: boolean;
}

// Per week row, the slices of the ranges it covers, stacked in the fewest lanes
// (earlier first, longer first on a tie).
export function weekBars(weeks: WeekDay[][], ranges: SpanRange[]): WeekBar[][] {
  return weeks.map((week) => {
    const first = week[0].dayIdx;
    const last = week[week.length - 1].dayIdx;
    const slices = ranges
      .filter((r) => r.endIdx >= first && r.startIdx <= last)
      .map((r) => ({
        id: r.id,
        label: r.label,
        bg: r.bg,
        color: r.color,
        startCol: Math.max(r.startIdx, first) - first,
        endCol: Math.min(r.endIdx, last) - first,
        continuesBefore: r.startIdx < first,
        continuesAfter: r.endIdx > last,
      }))
      .sort((a, b) => a.startCol - b.startCol || b.endCol - a.endCol);

    const laneEnds: number[] = [];
    return slices.map((s) => {
      let lane = laneEnds.findIndex((end) => end < s.startCol);
      if (lane < 0) lane = laneEnds.length;
      laneEnds[lane] = s.endCol;
      return { ...s, lane };
    });
  });
}
