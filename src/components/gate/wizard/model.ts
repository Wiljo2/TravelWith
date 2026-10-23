import type { KeyboardEvent } from "react";
import type { TripBooking, TripCompanion } from "@/types";

export interface WizardAnswers {
  destination: string;
  startDate: string;
  endDate: string;
  companion: TripCompanion | null;
  people: number;
  resolved: TripBooking[];
  nothingYet: boolean;
}

export const INITIAL_ANSWERS: WizardAnswers = {
  destination: "",
  startDate: "",
  endDate: "",
  companion: null,
  people: 1,
  resolved: [],
  nothingYet: false,
};

export function onEnterKey(action: () => void) {
  return (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.nativeEvent.isComposing) action();
  };
}
