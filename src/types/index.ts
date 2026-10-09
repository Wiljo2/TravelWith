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
  mapsUrl?: string;       // Google Maps link: pins the activity's exact spot on the trip map
  documentId?: string;    // TripDocument it comes from
  icon?: string;          // emoji chosen by the user; absent = automatic (from the title)
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
  documentId?: string;    // TripDocument it comes from
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
  icon?: string;          // emoji chosen by the user; absent = automatic (from the title)
  options?: TaskOption[];  // candidate choices (a decision to resolve); unchosen options never sum into the confirmed total
  version?: number;
}

export type IdeaPlatform = "tiktok" | "instagram" | "youtube" | "other";
export type IdeaStatus = "idea" | "planned" | "discarded";

// Where a place/type suggestion came from: keyword rules, Claude's analysis, or
// the in-browser model of early builds ("ai", legacy).
export interface IdeaSuggestion {
  place?: string;
  cat?: string;           // key of IDEA_TYPES
  dayId?: string;         // legacy (early builds suggested days); ignored
  source: "rules" | "ai" | "claude";
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
  embedId?: string;         // TikTok video id, for the in-app player (short links don't carry it)
  placeManual?: boolean;    // place set by hand: "Analizar con Claude" leaves it alone
  catManual?: boolean;      // type set by hand: likewise
  moment?: IdeaMoment;      // moment in the plan set by hand: wins over the analysis and the rules
  version?: number;
}

// Where a member put an idea on the plan: an activity (eventId), a whole day,
// before the trip, or nowhere ({} = "no moment in this trip").
export interface IdeaMoment {
  dayId?: string;
  eventId?: string;
  before?: boolean;
}

// Where an idea fits the existing plan — shown read-only, never schedules anything.
// Either a specific activity (eventId), a free gap of a day (slot), or the day in general.
// `before`: something to do before the trip (buy, pack, book) for that day/activity.
export interface IdeaLink {
  ideaId: string;
  dayId: string;
  eventId?: string;
  slot?: { start: number; end: number };
  before?: boolean;
  reason?: string;           // why it fits (Claude) or the matching phrase (rules)
  source: "rules" | "ai" | "claude" | "manual";
}

// Where an activity happens, for the trip map. Taken from a Google Maps link in
// the activity when there is one; otherwise found by Claude (which place it is)
// and a geocoder (its exact coordinates). Found again when the activity's title
// or note change (`key`).
export interface EventPlace {
  key: string;                   // the title + note it was located from
  kind: "place" | "ship" | "none"; // ship = aboard the cruise; none = not a place
  name?: string;                 // "Bayside Marketplace"
  query?: string;                // "Bayside Marketplace, Miami, Florida": opens it in Google Maps
  lat?: number;
  lng?: number;
  source?: "link" | "geocoder" | "claude";
  photo?: string;                // Wikipedia photo of the place; "" = searched, none found
  photoPage?: string;            // the Wikipedia article it comes from (credit)
  version?: number;
}

// One "Analizar con Claude" run: its links and the ideas it actually read.
export interface IdeaPlanResult {
  links: IdeaLink[];
  // Place and type Claude read in each idea (only what it could tell).
  classes: { ideaId: string; place?: string; cat?: string }[];
  at: string;
  ideaIds: string[];
}

export type DocumentKind = "flight" | "lodging" | "insurance" | "ticket" | "other";

// A reference to a file kept in Google Drive. Only the id and a short neutral
// title are stored: the contents and any personal data stay in Drive, and
// Drive's own sharing decides who can open it.
export interface TripDocument {
  id: string;
  driveFileId: string;
  title: string;
  kind?: DocumentKind;    // default "other"
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
  ideas?: Idea[];
  ideaPlaces?: string[];   // places for organizing ideas; unset = derived from the trip
  ideaLinks?: IdeaLink[];  // last "Analizar con Claude" result (free matches are computed live)
  ideaLinksAt?: string;    // ISO time of that analysis
  ideaLinksIds?: string[]; // ideas that analysis read (the others are "new")
  eventPlaces?: Record<string, EventPlace>; // trip map: where each activity happens, by event id
  documents?: TripDocument[];
}

export interface RoomMember {
  userId: string;
  name: string;
  avatar?: string;
  joinedAt: string;
}

// One entry of the trip history (trip_changes), as the activity panel shows it.
export interface ActivityEntry {
  id: number;
  table: string;
  rowId: string;
  op: "INSERT" | "UPDATE" | "DELETE";
  at: string;
  userName: string | null;
  label: string | null;
  fields: string[];
}

export interface ToastAction {
  title: string;
  newStart: number;
  newEnd: number;
  undo: () => void;
}

export interface AgentAction {
  id: string;
  name: string;
  kind: "write" | "delete";
  summary: string;
}

export interface AgentDecision {
  id: string;
  approve: boolean;
}

export interface AgentPending {
  token: string;
  actions: AgentAction[];
  status: "pending" | "approved" | "rejected" | "expired";
  decisions?: AgentDecision[];
}

export interface AgentChatMessage {
  role: "user" | "assistant";
  content: string;
  tools?: string[];
  error?: boolean;
  pending?: AgentPending;
}
