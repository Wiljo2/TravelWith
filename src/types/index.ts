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

// A candidate choice inside an undecided task, each with its own optional cost.
// Choosing an option confirms the task into a real activity + budget line.
export interface TaskOption {
  id: string;
  label: string;
  note?: string;                     // link / details / price notes
  amount?: number;                   // cost of this option, in `currency`
  currency?: "USD" | "COP";          // default "USD"
  splitMode?: "group" | "perPerson"; // default "group"
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
}

export type IdeaPlatform = "tiktok" | "instagram" | "youtube" | "other";
export type IdeaStatus = "idea" | "planned" | "discarded";

// Where a place/type suggestion came from: keyword rules or the in-browser model.
export interface IdeaSuggestion {
  place?: string;
  cat?: string;           // key of IDEA_TYPES
  dayId?: string;         // legacy (early builds suggested days); ignored
  source: "rules" | "ai";
}

// Inspiration a member shared (reel, TikTok, link) about places of the trip.
// Lives apart from the itinerary: organized by place and type, never scheduled.
export interface Idea {
  id: string;
  url: string;
  platform: IdeaPlatform;
  createdAt: string;        // ISO
  title?: string;           // post caption, from oEmbed when available
  tags?: string[];          // hashtags + platform keywords (TikTok)
  transcript?: string;      // what the video says (TikTok's automatic captions); "" = video has none
  author?: string;
  thumbnail?: string;
  note?: string;            // what the member wrote when sharing it
  addedBy?: string;
  place?: string;           // confirmed place (one of the trip's idea places)
  cat?: string;             // confirmed type (key of IDEA_TYPES; unknown keys = unset)
  suggestion?: IdeaSuggestion;
  status?: IdeaStatus;      // default "idea"
  votes?: string[];         // voter keys
  placesKey?: string;       // the place list its suggestion was computed with
  dayId?: string;           // legacy, ignored
  eventId?: string;         // legacy, ignored
}

// Where an idea fits the existing plan — shown read-only, never schedules anything.
// Either a specific activity (eventId), a free gap of a day (slot), or the day in general.
export interface IdeaLink {
  ideaId: string;
  dayId: string;
  eventId?: string;
  slot?: { start: number; end: number };
  reason?: string;           // why it fits (Claude) or the matching phrase (rules)
  source: "rules" | "ai" | "claude";
}

// One "Analizar con Claude" run: its links and the ideas it actually read.
export interface IdeaPlanResult {
  links: IdeaLink[];
  at: string;
  ideaIds: string[];
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
