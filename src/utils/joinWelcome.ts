import {
  MAX_WELCOME_ITEMS, UNDECIDED_DESTINATION, WELCOME_ITEMS, WELCOME_ITEM_KEYS, type WelcomeItemKey,
} from "@/constants/joinWelcome";
import { activityCount, fmtTripDates, hasDates, UNDATED_LABEL } from "@/utils/tripDays";
import { namesText, openVote, type VoteTask } from "@/utils/votes";
import { shortName } from "@/utils/userName";
import type { Tab } from "@/components/TabBar";
import type { Day, RoomMember, Task, TripInfo } from "@/types";

export interface WelcomeData {
  tasks: Task[];
  days: Pick<Day, "events">[];
  ideas: number;
}

export interface WelcomeItem {
  key: WelcomeItemKey;
  icon: string;
  label: string;
  detail: string;
  tab: Tab;
}

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function voteDetail(task: VoteTask | undefined, proposed: [string, string], ask: string, empty: string): string | null {
  if (!task) return null;
  const options = task.options?.length ?? 0;
  return options === 0 ? empty : `${count(options, ...proposed)}: ${ask}`;
}

// Null: the trip has nothing of that kind waiting.
const DETAILS: Record<WelcomeItemKey, (data: WelcomeData) => string | null> = {
  voteDates: (d) => voteDetail(
    openVote(d.tasks, "dates"), ["rango propuesto", "rangos propuestos"],
    "vota con ✋ los que te sirvan.", "Nadie ha propuesto fechas: propón un rango.",
  ),
  voteDestination: (d) => voteDetail(
    openVote(d.tasks, "destination"), ["destino propuesto", "destinos propuestos"],
    "vota con ✋ los que te gusten.", "Nadie ha propuesto destinos: propón uno.",
  ),
  ideas: (d) => (d.ideas === 0
    ? "Guarda lo que viste del destino para planear juntos."
    : `El grupo ya guardó ${count(d.ideas, "idea", "ideas")}; suma las tuyas.`),
  itinerary: (d) => {
    const activities = activityCount(d.days);
    return activities === 0 ? null : `${count(activities, "actividad planeada", "actividades planeadas")}.`;
  },
};

// "Lo que te espera" for someone who just joined: open votes first, then ideas and the itinerary.
export function welcomeItems(data: WelcomeData): WelcomeItem[] {
  return WELCOME_ITEM_KEYS.flatMap((key) => {
    const detail = DETAILS[key](data);
    return detail === null ? [] : [{ key, ...WELCOME_ITEMS[key], detail }];
  }).slice(0, MAX_WELCOME_ITEMS);
}

export interface TripFacts {
  dates: string;
  destination: string | null;
}

export function tripFacts(trip: TripInfo | null, tasks: Task[]): TripFacts {
  const dates = (hasDates(trip) && fmtTripDates(trip.startDate, trip.endDate)) || UNDATED_LABEL;
  const destination = trip?.destination?.trim() || (openVote(tasks, "destination") ? UNDECIDED_DESTINATION : null);
  return { dates, destination };
}

export interface TravelersSummary {
  title: string;
  line: string;
}

// "4 viajeros" / "Tú, Ana y Luis · 1 por unirse": the person joining first, then the
// other members, then the placeholder travelers who haven't joined.
export function travelersSummary(members: Pick<RoomMember, "userId" | "name">[], me: string, placeholders: number): TravelersSummary {
  const others = members.filter((m) => m.userId !== me).map((m) => shortName(m.name));
  const names = namesText(["Tú", ...others]);
  const people = 1 + others.length + placeholders;
  return {
    title: count(people, "viajero", "viajeros"),
    line: placeholders > 0 ? `${names} · ${placeholders} por unirse` : names,
  };
}
