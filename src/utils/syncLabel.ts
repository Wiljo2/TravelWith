import type { SyncState } from "@/hooks/useTripOps";

const SHORT: Record<SyncState, string> = {
  idle: "Al día",
  saving: "Guardando…",
  saved: "Guardado",
  error: "Error al guardar",
};

export function syncLabel(state: SyncState): string {
  return SHORT[state];
}

// "Guardado · hace 5 min": how long ago the last write was confirmed.
export function savedAgo(state: SyncState, lastSavedAt: number | null, now: number): string | null {
  if (state !== "saved" || lastSavedAt === null) return null;
  const minutes = Math.floor((now - lastSavedAt) / 60_000);
  if (minutes < 1) return null;
  if (minutes < 60) return `hace ${minutes} min`;
  return `hace ${Math.floor(minutes / 60)} h`;
}
