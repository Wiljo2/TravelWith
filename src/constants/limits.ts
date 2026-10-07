import { MAX_TRIP_DAYS } from "@/utils/tripDays";

// Size limits for persisted trip data. Shared by payload validation (PATCH),
// the domain layer (agent writes) and the agent chat endpoint.
export const LIMITS = {
  bodyBytes: 512 * 1024,
  days: MAX_TRIP_DAYS,
  eventsPerDay: 100,
  spansPerDay: 50,
  tripSpans: 200,
  extras: 500,
  tasks: 500,
  optionsPerTask: 20,
  documents: 100,
  documentTitle: 120,
  travelers: 50,
  title: 200,
  label: 200,
  name: 80,
  note: 4000,
  id: 100,
  chatMessage: 4000,
  chatHistory: 40000,
} as const;
