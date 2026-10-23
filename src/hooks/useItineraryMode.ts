import { useCallback, useState } from "react";

export type ItineraryMode = "agenda" | "grid" | "month";

const MODE_KEY = "tw.itineraryMode";

function readMode(): ItineraryMode {
  try {
    const stored = localStorage.getItem(MODE_KEY);
    return stored === "grid" || stored === "month" ? stored : "agenda";
  } catch {
    return "agenda";
  }
}

// The itinerary view, remembered on this device. "month" falls back to the agenda
// on trips that fit in one week.
export function useItineraryMode(monthAvailable: boolean) {
  const [stored, setStored] = useState<ItineraryMode>(readMode);
  const mode: ItineraryMode = stored === "month" && !monthAvailable ? "agenda" : stored;
  const setMode = useCallback((next: ItineraryMode) => {
    setStored(next);
    try { localStorage.setItem(MODE_KEY, next); } catch { /* storage unavailable */ }
  }, []);
  return [mode, setMode] as const;
}
