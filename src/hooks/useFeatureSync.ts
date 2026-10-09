import { useCallback, useEffect, useRef } from "react";
import type { SendOp } from "@/hooks/useTripOps";
import { diffOps, markRow, markSettings, snapshot, type FeatureState, type Synced } from "@/utils/featureSync";
import type { TripTable } from "@/utils/tripRows";

// Sends ideas, documents, map places and the idea settings as ops: after each
// render, whatever differs from what the server last confirmed (see
// utils/featureSync). Loads and remote rows update that baseline first, so
// they are never sent back.
export function useFeatureSync(enabled: boolean, send: SendOp, state: FeatureState) {
  const synced = useRef<Synced | null>(null);

  const reset = useCallback((loaded: FeatureState) => {
    synced.current = snapshot(loaded);
  }, []);
  const confirmRow = useCallback((table: TripTable, id: string, item: object | null) => {
    if (synced.current) markRow(synced.current, table, id, item);
  }, []);
  const confirmSettings = useCallback((settings: Pick<FeatureState, "ideaPlaces" | "ideaPlan">) => {
    if (synced.current) markSettings(synced.current, settings);
  }, []);

  const { ideas, documents, eventPlaces, ideaPlaces, ideaPlan } = state;
  useEffect(() => {
    if (!enabled || !synced.current) return;
    const current = { ideas, documents, eventPlaces, ideaPlaces, ideaPlan };
    const ops = diffOps(synced.current, current);
    if (!ops.length) return;
    synced.current = snapshot(current);
    for (const { op, args } of ops) send(op, args);
  }, [enabled, send, ideas, documents, eventPlaces, ideaPlaces, ideaPlan]);

  return { reset, confirmRow, confirmSettings };
}
