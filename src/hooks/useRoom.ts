import { useEffect, useRef, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { useTripChannel } from "@/hooks/useTripChannel";
import { needsRefetch, type TripMessage } from "@/utils/tripChannel";
import { loadSnapshot, saveSnapshot } from "@/lib/offline";
import type { RoomMember, RoomPayload } from "@/types";
import type { Row, TripTable } from "@/utils/tripRows";

export type { MockPerson, RoomPayload } from "@/types";

export interface RoomHandlers {
  onLoad: (payload: RoomPayload) => void;
  onRow: (table: TripTable, id: string, row: Row | null, version: number) => void;
  onHeader: (header: Record<string, unknown>) => void;
  // The room was deleted or we were removed from it.
  onGone: () => void;
  // Refetching replaces local state, so it waits while writes are pending.
  canResync: () => boolean;
}

interface UseRoomResult {
  connected: boolean;
  // Set while the room couldn't be reached and the device's last copy is shown:
  // when that copy was taken (ISO).
  offlineSince: string | null;
  members: RoomMember[];
  reload: () => void;
}

const RESYNC_DEBOUNCE_MS = 250;
const RESYNC_RETRY_MS = 1000;

// Loads the trip (assembled from the trip tables by GET /api/rooms/[code])
// and applies live changes from the private trip channel. Writes go through
// useTripOps.
export function useRoom(code: string | null, accessToken: string | undefined, handlers: RoomHandlers): UseRoomResult {
  const [loaded, setLoaded] = useState(false);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [offlineSince, setOfflineSince] = useState<string | null>(null);
  // Tokens refresh about hourly; refs keep requests current without resubscribing.
  const token = useRef(accessToken);
  const h = useRef(handlers);
  useEffect(() => {
    token.current = accessToken;
    h.current = handlers;
  });
  const hasToken = !!accessToken;

  const reload = useCallback(() => {
    if (!code || code === "LOCAL") return;
    apiFetch(`/api/rooms/${code}`, token.current)
      .then((r) => {
        if (!r.ok) throw new Error(`GET room ${r.status}`);
        return r.json();
      })
      .then((data) => {
        const p = data?.payload as RoomPayload | undefined;
        const roster = Array.isArray(data?.members) ? (data.members as RoomMember[]) : [];
        if (p?.days && Array.isArray(p.days)) {
          h.current.onLoad(p);
          saveSnapshot(code, { payload: p, members: roster });
        }
        setMembers(roster);
        setOfflineSince(null);
        setLoaded(true);
      })
      .catch(() => {
        // No network: show this device's last copy and load the room again
        // once the network is back.
        setLoaded(false);
        const snap = loadSnapshot(code);
        if (!snap) return;
        h.current.onLoad(snap.payload);
        setMembers(snap.members);
        setOfflineSince(snap.savedAt);
      });
  }, [code]);

  const resyncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleResync = useCallback(() => {
    const schedule = (delay: number) => {
      if (resyncTimer.current) clearTimeout(resyncTimer.current);
      resyncTimer.current = setTimeout(() => {
        resyncTimer.current = null;
        if (h.current.canResync()) reload();
        else schedule(RESYNC_RETRY_MS);
      }, delay);
    };
    schedule(RESYNC_DEBOUNCE_MS);
  }, [reload]);

  useEffect(() => {
    if (!code || code === "LOCAL" || !hasToken) return;
    reload();
    return () => {
      if (resyncTimer.current) clearTimeout(resyncTimer.current);
      setLoaded(false);
    };
  }, [code, hasToken, reload]);

  useEffect(() => {
    if (!offlineSince) return;
    window.addEventListener("online", reload);
    return () => window.removeEventListener("online", reload);
  }, [offlineSince, reload]);

  const onMessage = useCallback((m: TripMessage) => {
    if (m.kind === "roomDeleted") return h.current.onGone();
    if (m.kind === "room") {
      if (Array.isArray(m.record.members)) setMembers(m.record.members as RoomMember[]);
      return h.current.onHeader(m.record);
    }
    if (needsRefetch(m)) return scheduleResync();
    h.current.onRow(m.table, m.id, m.row, m.version);
  }, [scheduleResync]);

  const { subscribed } = useTripChannel(code, hasToken, {
    onMessage,
    onResync: () => scheduleResync(),
    onDenied: () => h.current.onGone(),
  });

  return { connected: loaded && subscribed, offlineSince, members, reload };
}
