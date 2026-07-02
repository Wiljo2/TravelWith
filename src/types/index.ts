export interface CalendarEvent {
  id: string;
  start: number;
  end: number;
  title: string;
  cat: string;
  note: string;
}

// A span defined at the trip level that can cross multiple days.
// startEventId / endEventId can belong to different days.
// DayColumn receives pre-resolved DaySpan slices — it never needs to know about TripSpan.
export interface TripSpan {
  id: string;
  label?: string;
  startEventId: string;   // in any day
  endEventId: string;     // in any day (same or different)
  bg: string;
  border: string;
  zIndex?: number;
}

// A colored time-range block within a day. startEventId/endEventId are resolved
// at render time from the day's events, so spans track events when they're moved.
export interface DaySpan {
  id: string;
  label?: string;
  startEventId?: string; // if set, span.start = that event's start time
  endEventId?: string;   // if set, span.end = that event's end time
  startHour?: number;    // fallback explicit hour
  endHour?: number;      // fallback explicit hour
  bg: string;
  border: string;
  zIndex?: number;       // lower = further back; higher = drawn on top
}

export interface Day {
  id: string;
  label: string;
  sub: string;
  flexible: boolean;
  spans?: DaySpan[];
  events: CalendarEvent[];
}

export interface Category {
  label: string;
  bg: string;
  border: string;
  text: string;
  dot: string;
}

export interface DragPreview {
  dayId: string;
  newStart: number;
  newEnd: number;
  ev: CalendarEvent;
}

export interface Extra {
  id: string;
  label: string;
  amount: number;         // in `currency`; group total when splitMode="group", per-person when "perPerson"
  currency?: "USD" | "COP"; // default "USD"
  splitMode?: "group" | "perPerson"; // default "group"
  linkedEventId?: string;
  // If startDayId is set, this extra belongs to the per-day timeline instead of Globales.
  // amount is divided across the days in the range for the per-day display.
  startDayId?: string;
  endDayId?: string;      // if omitted, defaults to startDayId (single day)
}

export type TaskPriority = "alta" | "media" | "baja";

export interface Task {
  id: string;
  title: string;
  done: boolean;
  note?: string;
  dayId?: string;         // set → placed on the calendar; unset → backlog
  start?: number;
  end?: number;
  cat?: string;           // key of TASK_CATEGORIES
  priority?: TaskPriority;
}

export interface RoomMember {
  userId: string;
  name: string;
  avatar?: string;
  joinedAt: string;
}

export interface ToastAction {
  title: string;
  newStart: number;
  newEnd: number;
  undo: () => void;
}
