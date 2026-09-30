import type { Day } from "@/types";
import { HOUR_START, HOUR_END } from "@/constants/time";

const WEEKDAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export const MAX_TRIP_DAYS = 60;

// Parses "yyyy-mm-dd" as a local date (avoids UTC off-by-one from Date("...")).
// Rejects rollover dates like 2026-13-99, which the Date constructor would accept.
export function parseISODate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return d;
}

export function dayLabel(date: Date): string {
  return `${WEEKDAYS[date.getDay()]} · ${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

// Builds one empty Day per calendar date in [startDate, endDate], inclusive.
// Returns null when dates are invalid, reversed, or the range exceeds MAX_TRIP_DAYS.
export function generateDays(startDate: string, endDate: string): Day[] | null {
  const start = parseISODate(startDate);
  const end = parseISODate(endDate);
  if (!start || !end || end < start) return null;

  const days: Day[] = [];
  const cursor = new Date(start);
  let i = 0;
  while (cursor <= end) {
    if (i >= MAX_TRIP_DAYS) return null;
    days.push({
      id: `d${i}`,
      label: dayLabel(cursor),
      sub: "",
      flexible: false,
      events: [],
    });
    cursor.setDate(cursor.getDate() + 1);
    i++;
  }
  return days;
}

// Next free slot for a quick "+ Actividad": right after the day's last activity.
export function nextFreeHour(day: Day): number {
  const lastEnd = Math.max(0, ...day.events.map((e) => e.end));
  return lastEnd ? Math.min(Math.ceil(lastEnd), HOUR_END - 1) : 9;
}

export type TripPhase =
  | { phase: "before"; daysLeft: number }
  | { phase: "during"; dayIdx: number; hour: number }
  | { phase: "after" };

// Where `now` falls relative to the trip. `dayCount` is the itinerary length.
// Itinerary days run HOUR_START..HOUR_END (past midnight), so 1:00 am still
// belongs to the previous day, at hour 25.
export function tripPhase(startDate: string, dayCount: number, now: Date = new Date()): TripPhase | null {
  const start = parseISODate(startDate);
  if (!start) return null;
  let hour = now.getHours() + now.getMinutes() / 60;
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (hour < HOUR_START) {
    hour += 24;
    date.setDate(date.getDate() - 1);
  }
  const offset = Math.round((date.getTime() - start.getTime()) / 86_400_000);
  if (offset < 0) return { phase: "before", daysLeft: -offset };
  if (offset < dayCount) return { phase: "during", dayIdx: offset, hour };
  return { phase: "after" };
}

// Index of today within the trip, or undefined when the trip isn't underway.
export function tripDayIndex(startDate: string, dayCount: number): number | undefined {
  const p = tripPhase(startDate, dayCount);
  return p?.phase === "during" ? p.dayIdx : undefined;
}

export function fmtTripDates(startDate: string, endDate: string): string {
  const start = parseISODate(startDate);
  const end = parseISODate(endDate);
  if (!start || !end) return "";
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  const startTxt = `${MONTHS[start.getMonth()]} ${start.getDate()}`;
  const endTxt = sameMonth ? `${end.getDate()}` : `${MONTHS[end.getMonth()]} ${end.getDate()}`;
  return `${startTxt} – ${endTxt}, ${end.getFullYear()}`;
}
