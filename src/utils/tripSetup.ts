import type { StarterTask, TripBooking, TripCompanion, TripInfo } from "@/types";
import { LIMITS } from "@/constants/limits";
import {
  BOOKINGS, BOOKING_KEYS, COMPANIONS, MAX_TRIP_PEOPLE, STARTER_TASK_CAT, STARTER_TASK_PRIORITY,
} from "@/constants/tripSetup";
import { MONTHS, hasDates, parseISODate } from "@/utils/tripDays";

const NO_DESTINATION_NAME = "Mi viaje";

// "Cartagena con amigos · Dic 2026": destination (or "Mi viaje"), who's going, start month.
export function suggestTripName(destination: string, companion: TripCompanion | null, startDate?: string): string {
  const place = destination.trim() || NO_DESTINATION_NAME;
  const phrase = companion ? COMPANIONS[companion].namePhrase : "";
  const start = startDate ? parseISODate(startDate) : null;
  const when = start ? ` · ${MONTHS[start.getMonth()]} ${start.getFullYear()}` : "";
  const base = phrase ? `${place} ${phrase}` : place;
  return `${base.slice(0, LIMITS.name - when.length).trim()}${when}`;
}

export function clampPeople(people: number): number {
  if (!Number.isFinite(people)) return 1;
  return Math.min(MAX_TRIP_PEOPLE, Math.max(1, Math.round(people)));
}

// Everyone but the creator: "Viajero 2" … "Viajero N".
export function placeholderTravelers(people: number): string[] {
  return Array.from({ length: clampPeople(people) - 1 }, (_, i) => `Viajero ${i + 2}`);
}

// One "Reservar …" task per booking that is not resolved yet.
export function starterTasks(resolved: TripBooking[]): StarterTask[] {
  return BOOKING_KEYS
    .filter((key) => !resolved.includes(key))
    .map((key) => ({ title: BOOKINGS[key].task, cat: STARTER_TASK_CAT, priority: STARTER_TASK_PRIORITY }));
}

export function tripHeader(trip: TripInfo): TripInfo {
  const { name, destination } = trip;
  return hasDates(trip) ? { name, destination, startDate: trip.startDate, endDate: trip.endDate } : { name, destination };
}
