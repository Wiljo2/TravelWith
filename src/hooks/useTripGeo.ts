import { useCallback, useState } from "react";
import type { RoomPayload } from "@/hooks/useRoom";
import type { Day, EventPlace } from "@/types";
import { rowToEventPlace, type Row } from "@/utils/tripRows";

// Where each activity happens (trip map), in and out of the room payload.
export function useTripGeo() {
  const [eventPlaces, setEventPlaces] = useState<Record<string, EventPlace>>({});

  // A missing or malformed field means "nothing located yet".
  const loadPayload = useCallback((p: RoomPayload) => {
    const v = p.eventPlaces;
    setEventPlaces(v && typeof v === "object" && !Array.isArray(v) ? v : {});
  }, []);

  // New locations in; those of deleted activities out.
  function merge(found: Record<string, EventPlace>, days: Day[]) {
    const ids = new Set(days.flatMap((d) => d.events.map((e) => e.id)));
    setEventPlaces((prev) => Object.fromEntries(Object.entries({ ...prev, ...found }).filter(([id]) => ids.has(id))));
  }

  // One place as the server has it; null removes it. Older versions are ignored.
  const applyRow = useCallback((id: string, row: Row | null) => {
    setEventPlaces((prev) => {
      if (!row) {
        if (!(id in prev)) return prev;
        const { [id]: _gone, ...rest } = prev;
        return rest;
      }
      if ((prev[id]?.version ?? 0) >= row.version) return prev;
      return { ...prev, [id]: rowToEventPlace(row) };
    });
  }, []);

  return { eventPlaces, loadPayload, payload: { eventPlaces }, merge, applyRow };
}
