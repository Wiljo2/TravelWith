import type { Tab } from "@/components/TabBar";

export type WelcomeItemKey = "voteDates" | "voteDestination" | "ideas" | "itinerary";

export interface WelcomeItemInfo {
  icon: string;
  label: string;
  // Votes live on Inicio (VoteCard / UndatedHero).
  tab: Tab;
}

// In the order the welcome lists them.
export const WELCOME_ITEMS: Record<WelcomeItemKey, WelcomeItemInfo> = {
  voteDates:       { icon: "📅", label: "Vota las fechas",                          tab: "home" },
  voteDestination: { icon: "📍", label: "Vota el destino",                          tab: "home" },
  ideas:           { icon: "🎬", label: "Agrega tus ideas (TikToks, reels, links)", tab: "ideas" },
  itinerary:       { icon: "🗓️", label: "Mira el itinerario",                       tab: "calendar" },
};

export const WELCOME_ITEM_KEYS = Object.keys(WELCOME_ITEMS) as WelcomeItemKey[];

export const MAX_WELCOME_ITEMS = 3;

export const UNDECIDED_DESTINATION = "Destino por decidir";
