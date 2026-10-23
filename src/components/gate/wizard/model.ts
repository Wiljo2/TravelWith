import type { KeyboardEvent } from "react";
import type { NewTrip, TaskDecides, TripBooking, TripCompanion } from "@/types";
import { placeholderTravelers, starterTasks, voteStarterTasks } from "@/utils/tripSetup";

export interface WizardAnswers {
  destination: string;
  // "Aún no sabemos, lo votamos": the trip starts with that vote open instead.
  voteDestination: boolean;
  startDate: string;
  endDate: string;
  voteDates: boolean;
  companion: TripCompanion | null;
  people: number;
  resolved: TripBooking[];
  nothingYet: boolean;
}

export const INITIAL_ANSWERS: WizardAnswers = {
  destination: "",
  voteDestination: false,
  startDate: "",
  endDate: "",
  voteDates: false,
  companion: null,
  people: 1,
  resolved: [],
  nothingYet: false,
};

export function votedKinds(answers: Pick<WizardAnswers, "voteDates" | "voteDestination">): TaskDecides[] {
  return [answers.voteDates && "dates", answers.voteDestination && "destination"].filter((k): k is TaskDecides => !!k);
}

// The POST /api/rooms body: no dates while they are put to a vote, and one
// starter task per open vote (dates first) and per booking not resolved yet.
export function wizardTrip(answers: WizardAnswers, name: string): NewTrip {
  const destination = answers.voteDestination ? "" : answers.destination.trim();
  return {
    name: name.trim(),
    destination: destination || undefined,
    ...(answers.voteDates ? {} : { startDate: answers.startDate, endDate: answers.endDate }),
    travelers: placeholderTravelers(answers.people),
    tasks: [...voteStarterTasks(votedKinds(answers)), ...starterTasks(answers.resolved)],
  };
}

export function onEnterKey(action: () => void) {
  return (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.nativeEvent.isComposing) action();
  };
}
