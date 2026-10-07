import { MAX_TRIP_DAYS } from "@/utils/tripDays";

// Size limits for trip data. Shared by the row validators (ops and agent
// writes), the payload schema (reading the frozen backup) and the agent chat.
export const LIMITS = {
  days: MAX_TRIP_DAYS,
  eventsPerDay: 100,
  spansPerDay: 50,
  tripSpans: 200,
  extras: 500,
  tasks: 500,
  optionsPerTask: 20,
  travelers: 50,
  title: 200,
  label: 200,
  name: 80,
  note: 4000,
  id: 100,
  chatMessage: 4000,
  chatHistory: 40000,
} as const;
