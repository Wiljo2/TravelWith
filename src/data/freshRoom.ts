import type { RoomPayload, TripInfo } from "@/types";
import { generateDays } from "@/utils/tripDays";
import { DEFAULT_RATE } from "@/utils/currency";

const TRIP_LEAD_DAYS = 30;
const TRIP_LENGTH_DAYS = 5;

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// What POST /api/rooms leaves behind: the header and empty days, nothing else.
// Without a trip from the form, a 5-day trip a month from today.
export function freshRoomPayload(trip: TripInfo | null, now = new Date()): RoomPayload {
  const header = trip ?? defaultTrip(now);
  return { days: generateDays(header.startDate, header.endDate) ?? [], extras: [], exchangeRate: DEFAULT_RATE, trip: header };
}

function defaultTrip(now: Date): TripInfo {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + TRIP_LEAD_DAYS);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + TRIP_LENGTH_DAYS - 1);
  return { name: "Mi viaje", startDate: isoDate(start), endDate: isoDate(end) };
}
