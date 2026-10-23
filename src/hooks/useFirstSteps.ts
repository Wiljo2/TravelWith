import { useCallback, useEffect, useSyncExternalStore } from "react";
import { LOCAL_ROOM_CODE } from "@/data/localMode";
import {
  firstSteps, initialVisibility, parseVisibility, type FirstStepsData, type FirstStepsVisibility,
} from "@/utils/firstSteps";

const KEY_PREFIX = "tw-first-steps:";

// Used when storage is blocked, and always for the local trip: it lives in memory and
// starts over on every load, so its card must too.
const memory = new Map<string, FirstStepsVisibility>();
const listeners = new Set<() => void>();

function read(code: string): FirstStepsVisibility | null {
  if (code !== LOCAL_ROOM_CODE) {
    try {
      const stored = parseVisibility(localStorage.getItem(KEY_PREFIX + code));
      if (stored) return stored;
    } catch { /* storage blocked */ }
  }
  return memory.get(code) ?? null;
}

function write(code: string, value: FirstStepsVisibility) {
  memory.set(code, value);
  if (code !== LOCAL_ROOM_CODE) {
    try {
      localStorage.setItem(KEY_PREFIX + code, value);
    } catch { /* storage blocked: kept in memory for this page */ }
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

interface FirstStepsOptions {
  roomCode: string;
  // The open trip's data arrived from the server; until then the hooks may still hold
  // the previously opened trip's.
  loaded: boolean;
  // The local trip is seeded in memory, without a server load.
  hasTrip: boolean;
  data: FirstStepsData;
}

// "Primeros pasos", per trip and per device: decided the first time the trip's data is
// seen here, then shown until dismissed.
export function useFirstSteps({ roomCode, loaded, hasTrip, data }: FirstStepsOptions) {
  const progress = firstSteps(data);
  const visibility = useSyncExternalStore(subscribe, () => read(roomCode), () => null);
  const ready = roomCode === LOCAL_ROOM_CODE ? hasTrip : loaded;
  const undecided = ready && visibility === null;
  const { doneCount } = progress;

  useEffect(() => {
    if (undecided) write(roomCode, initialVisibility(doneCount));
  }, [undecided, roomCode, doneCount]);

  const dismiss = useCallback(() => write(roomCode, "dismissed"), [roomCode]);

  return { ...progress, visible: visibility === "shown", dismiss };
}
