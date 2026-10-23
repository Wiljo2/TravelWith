import type { MockPerson, NewTrip, RoomPayload, StarterTask, Task, TripInfo } from "@/types";
import { LIMITS } from "@/constants/limits";
import { generateDays } from "@/utils/tripDays";
import { DEFAULT_RATE } from "@/utils/currency";
import { tripHeader } from "@/utils/tripSetup";

const TRIP_LEAD_DAYS = 30;
const TRIP_LENGTH_DAYS = 5;

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// What POST /api/rooms leaves behind: the header, empty days and the wizard's
// placeholder travelers and starter tasks. Without a trip from the wizard, a
// 5-day trip a month from today.
export function freshRoomPayload(trip: NewTrip | null, now = new Date()): RoomPayload {
  const header = trip ? tripHeader(trip) : defaultTrip(now);
  return {
    days: generateDays(header.startDate, header.endDate) ?? [],
    extras: [],
    exchangeRate: DEFAULT_RATE,
    trip: header,
    mockPeople: seedTravelers(trip?.travelers),
    tasks: seedTasks(trip?.tasks),
  };
}

function seedTravelers(names: unknown): MockPerson[] {
  if (!Array.isArray(names)) return [];
  return names.slice(0, LIMITS.travelers).map((name, i) => ({ id: `mp-${i + 1}`, name: String(name) }));
}

function seedTasks(tasks: unknown): Task[] {
  if (!Array.isArray(tasks)) return [];
  return tasks.slice(0, LIMITS.starterTasks).map((t: StarterTask, i) => ({
    id: `task-${i + 1}`,
    title: t.title,
    done: false,
    cat: t.cat,
    priority: t.priority,
  }));
}

function defaultTrip(now: Date): TripInfo {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + TRIP_LEAD_DAYS);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + TRIP_LENGTH_DAYS - 1);
  return { name: "Mi viaje", startDate: isoDate(start), endDate: isoDate(end) };
}
