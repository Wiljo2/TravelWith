import { useCallback, useEffect, useRef } from "react";
import { useItinerary } from "@/hooks/useItinerary";
import { useBudget } from "@/hooks/useBudget";
import { useTasks } from "@/hooks/useTasks";
import { useTripInfo } from "@/hooks/useTripInfo";
import { useTripOps } from "@/hooks/useTripOps";
import { useRoom } from "@/hooks/useRoom";
import { useIdeas } from "@/hooks/useIdeas";
import { useTripGeo } from "@/hooks/useTripGeo";
import { useDocuments } from "@/hooks/useDocuments";
import type { RoomPayload } from "@/types";
import type { Row, TripTable } from "@/utils/tripRows";

// All trip state for the open room: the domain hooks, the op queue that saves
// their changes, and the load + live channel that fills them.
export function useTripData(roomCode: string | null, accessToken: string | undefined, localMode: boolean, onGone: () => void) {
  const ops = useTripOps(roomCode, accessToken, {
    adoptRow: (table, id, row) => adoptRow(table, id, row),
    applyHeader: (header) => applyHeader(header),
    resync: () => room.reload(),
  });
  const itinerary = useItinerary(ops.send);
  const budget = useBudget(ops.send);
  const taskState = useTasks(ops.send, ops.isKnown);
  const tripInfo = useTripInfo(ops.send);
  const ideasApi = useIdeas(roomCode, accessToken);
  const geoApi = useTripGeo();
  const docs = useDocuments();

  function applyHeader(header: Record<string, unknown>) {
    tripInfo.applyHeader(header);
    if (header.exchange_rate != null) budget.setRate(Number(header.exchange_rate));
  }

  function adoptRow(table: TripTable, id: string, row: Row | null) {
    if (table === "trip_expenses") budget.applyRow(id, row);
    else if (table === "trip_tasks" || table === "trip_task_options") taskState.applyRow(table, id, row);
    else if (table === "trip_travelers") tripInfo.applyRow(id, row);
    else itinerary.applyRow(table, id, row);
  }

  const { seedVersions } = ops;
  const { loadItinerary } = itinerary;
  const { loadBudget } = budget;
  const { loadTasks } = taskState;
  const { loadTripInfo } = tripInfo;
  const { loadPayload: loadIdeas } = ideasApi;
  const { loadPayload: loadPlaces } = geoApi;
  const { loadPayload: loadDocuments } = docs;
  const onLoad = useCallback((payload: RoomPayload) => {
    seedVersions(payload);
    loadItinerary(payload.days, payload.tripSpans);
    loadBudget(payload.extras, payload.exchangeRate);
    loadTripInfo(payload.trip, payload.mockPeople);
    loadTasks(payload.tasks);
    loadIdeas(payload);
    loadPlaces(payload);
    loadDocuments(payload);
  }, [seedVersions, loadItinerary, loadBudget, loadTripInfo, loadTasks, loadIdeas, loadPlaces, loadDocuments]);

  const room = useRoom(roomCode, accessToken, {
    onLoad,
    onRow: (table, id, row, version) => {
      if (ops.acceptRemote(table, id, version, row === null)) adoptRow(table, id, row);
    },
    onHeader: applyHeader,
    onGone,
    canResync: ops.idle,
  });

  // useRoom fetches nothing for LOCAL, so the demo (or a local snapshot) is
  // seeded here, once. It is imported lazily and never in production builds.
  const localSeeded = useRef(false);
  useEffect(() => {
    // Inline NODE_ENV check (not LOCAL_MODE_ENABLED) so the bundler can drop the import.
    if (process.env.NODE_ENV === "production" || !localMode || localSeeded.current) return;
    localSeeded.current = true;
    import("@/data/localPayload").then(({ loadLocalPayload }) => loadLocalPayload()).then(onLoad);
  }, [localMode, onLoad]);
  const resetLocalSeed = useCallback(() => {
    localSeeded.current = false;
  }, []);

  // The whole trip as the client holds it (PDF export, map and ideas helpers).
  const payloadNow = (): RoomPayload => ({
    days: itinerary.days,
    extras: budget.extras,
    exchangeRate: budget.exchangeRate,
    trip: tripInfo.trip ?? undefined,
    mockPeople: tripInfo.mockPeople,
    tripSpans: itinerary.tripSpans,
    tasks: taskState.tasks,
    documents: docs.documents,
    ...ideasApi.payload,
    ...geoApi.payload,
  });

  return { ops, itinerary, budget, taskState, tripInfo, ideasApi, geoApi, docs, room, payloadNow, resetLocalSeed };
}
