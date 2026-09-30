// Trip identity — lives inside the room payload. A room IS a trip.
export interface TripInfo {
  name: string;
  destination?: string;
  startDate: string;      // ISO yyyy-mm-dd
  endDate: string;        // ISO yyyy-mm-dd
}

export interface CalendarEvent {
  id: string;
  start: number;
  end: number;
  title: string;
  cat: string;
  note: string;
  version?: number;
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
  version?: number;
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
  version?: number;
}

export interface Day {
  id: string;
  label: string;
  sub: string;
  flexible: boolean;
  spans?: DaySpan[];
  events: CalendarEvent[];
  version?: number;
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
  version?: number;
}

export type TaskPriority = "alta" | "media" | "baja";

// A candidate choice inside an undecided task, each with its own optional cost.
// Choosing an option confirms the task into a real activity + budget line.
export interface TaskOption {
  id: string;
  label: string;
  note?: string;                     // link / details / price notes
  amount?: number;                   // cost of this option, in `currency`
  currency?: "USD" | "COP";          // default "USD"
  splitMode?: "group" | "perPerson"; // default "group"
  version?: number;
}

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
  options?: TaskOption[];  // candidate choices (a decision to resolve); unchosen options never sum into the confirmed total
  version?: number;
}

// A traveler without an account, counted in per-person math.
export interface MockPerson {
  id: string;
  name: string;
  version?: number;
}

// The persisted trip document (rooms.payload). Every field added after the
// first release is optional; consumers apply defaults at read time.
// Items carry `version` (their row version) when read from the trip tables;
// writes send it back so the server can detect concurrent edits.
export interface RoomPayload {
  days: Day[];
  extras: Extra[];
  exchangeRate: number;
  trip?: TripInfo;
  mockPeople?: MockPerson[];
  tripSpans?: TripSpan[];
  tasks?: Task[];
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
