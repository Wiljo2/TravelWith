import { ESTABLISHED_TRIP_STEPS, FIRST_STEPS, FIRST_STEP_KEYS, type FirstStepKey } from "@/constants/firstSteps";
import type { Tab } from "@/components/TabBar";
import type { Day } from "@/types";

export interface FirstStepsData {
  // People who joined the trip, the creator included; placeholder travelers don't count.
  members: number;
  days: Pick<Day, "events">[];
  ideas: number;
  expenses: number;
  documents: number;
}

export interface FirstStep {
  key: FirstStepKey;
  label: string;
  done: boolean;
  tab?: Tab;
}

export interface FirstStepsProgress {
  steps: FirstStep[];
  doneCount: number;
}

export type FirstStepsVisibility = "shown" | "dismissed";

const IS_DONE: Record<FirstStepKey, (data: FirstStepsData) => boolean> = {
  invite:   (d) => d.members > 1,
  activity: (d) => d.days.some((day) => day.events.length > 0),
  idea:     (d) => d.ideas > 0,
  expense:  (d) => d.expenses > 0,
  document: (d) => d.documents > 0,
};

export function firstSteps(data: FirstStepsData): FirstStepsProgress {
  const steps = FIRST_STEP_KEYS.map((key): FirstStep => {
    const { label, tab } = FIRST_STEPS[key];
    return tab ? { key, label, done: IS_DONE[key](data), tab } : { key, label, done: IS_DONE[key](data) };
  });
  return { steps, doneCount: steps.filter((s) => s.done).length };
}

// The first time a device sees a trip: one already under way never gets the card.
export function initialVisibility(doneCount: number): FirstStepsVisibility {
  return doneCount >= ESTABLISHED_TRIP_STEPS ? "dismissed" : "shown";
}

export function parseVisibility(raw: string | null): FirstStepsVisibility | null {
  return raw === "shown" || raw === "dismissed" ? raw : null;
}
