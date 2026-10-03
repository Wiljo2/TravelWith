import type { Category } from '../types';

export const CATEGORIES: Record<string, Category> = {
  actividad:   { label: "Actividad",   bg: "#FAECE7", border: "#993C1D", text: "#4A1B0C", dot: "#D85A30" },
  transporte:  { label: "Transporte",  bg: "#E6F1FB", border: "#185FA5", text: "#042C53", dot: "#378ADD" },
  alojamiento: { label: "Alojamiento", bg: "#E1F5EE", border: "#0F6E56", text: "#04342C", dot: "#1D9E75" },
  comida:      { label: "Comida",      bg: "#FAEEDA", border: "#854F0B", text: "#412402", dot: "#EF9F27" },
  noche:       { label: "Noche",       bg: "#EEEDFE", border: "#534AB7", text: "#26215C", dot: "#7F77DD" },
  logist:      { label: "Logística",   bg: "#F1EFE8", border: "#5F5E5A", text: "#2C2C2A", dot: "#888780" },
  // Legacy keys from the first (cruise) trip: stored events still use them, so
  // they must keep rendering, but they are not offered for new events.
  barco:       { label: "A bordo",     bg: "#E1F5EE", border: "#0F6E56", text: "#04342C", dot: "#1D9E75" },
  puerto:      { label: "Puerto",      bg: "#E6F1FB", border: "#185FA5", text: "#042C53", dot: "#378ADD" },
  miami:       { label: "Miami",       bg: "#FAECE7", border: "#993C1D", text: "#4A1B0C", dot: "#D85A30" },
};

const LEGACY_CATEGORY_KEYS = new Set(["barco", "puerto", "miami"]);

// Categories offered in pickers, the legend and the agent's tool descriptions.
export const EVENT_CATEGORY_KEYS = Object.keys(CATEGORIES).filter((k) => !LEGACY_CATEGORY_KEYS.has(k));

export const DEFAULT_EVENT_CAT = "actividad";
