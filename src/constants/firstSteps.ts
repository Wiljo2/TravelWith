import type { Tab } from "@/components/TabBar";

export type FirstStepKey = "invite" | "activity" | "idea" | "expense" | "document";

export interface FirstStepInfo {
  label: string;
  action: string;
  // Where the action leads; without it the step is handled on Inicio itself.
  tab?: Tab;
}

export const FIRST_STEPS: Record<FirstStepKey, FirstStepInfo> = {
  invite:   { label: "Invita a tu grupo",                        action: "Invitar" },
  activity: { label: "Agrega tu primera actividad",              action: "Itinerario", tab: "calendar" },
  idea:     { label: "Guarda una idea (TikTok, reel o link)",    action: "Ideas",      tab: "ideas" },
  expense:  { label: "Registra un gasto",                        action: "Gastos",     tab: "budget" },
  document: { label: "Enlaza un documento (reservas, tiquetes)", action: "Documentos" },
};

export const FIRST_STEP_KEYS = Object.keys(FIRST_STEPS) as FirstStepKey[];

// A trip a device sees for the first time with this many steps done is already under way.
export const ESTABLISHED_TRIP_STEPS = 2;
