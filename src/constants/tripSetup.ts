import type { TaskPriority, TripBooking, TripCompanion } from "@/types";
import { LIMITS } from "@/constants/limits";

export interface CompanionOption {
  label: string;
  icon: string;
  people: number;     // default head count, creator included
  namePhrase: string; // appended to the destination in the suggested trip name
}

export const COMPANIONS: Record<TripCompanion, CompanionOption> = {
  solo:    { label: "Solo",       icon: "🧍", people: 1, namePhrase: "" },
  pareja:  { label: "En pareja",  icon: "💑", people: 2, namePhrase: "en pareja" },
  amigos:  { label: "Con amigos", icon: "🙌", people: 4, namePhrase: "con amigos" },
  familia: { label: "En familia", icon: "👨‍👩‍👧", people: 4, namePhrase: "en familia" },
};

export const COMPANION_KEYS = Object.keys(COMPANIONS) as TripCompanion[];

// The creator is a member, so the head count can exceed the traveler rows by one.
export const MAX_TRIP_PEOPLE = LIMITS.travelers + 1;

export interface BookingOption {
  label: string;
  icon: string;
  task: string; // starter task created when it is not resolved yet
}

export const BOOKINGS: Record<TripBooking, BookingOption> = {
  vuelos:      { label: "Vuelos",      icon: "✈️", task: "Reservar vuelos" },
  alojamiento: { label: "Alojamiento", icon: "🏨", task: "Reservar alojamiento" },
};

export const BOOKING_KEYS = Object.keys(BOOKINGS) as TripBooking[];

export const STARTER_TASK_CAT = "reservar";
export const STARTER_TASK_PRIORITY: TaskPriority = "alta";
