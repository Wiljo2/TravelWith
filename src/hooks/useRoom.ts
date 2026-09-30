import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import type { RoomMember, RoomPayload } from "@/types";

export type { MockPerson, RoomPayload } from "@/types";

interface UseRoomResult {
  connected: boolean;
  members: RoomMember[];
  reload: () => void;
}

// Loads the trip (assembled from the trip tables by GET /api/rooms/[code]).
// Writes go through useTripOps; rooms.payload is a frozen backup, so the
// realtime subscription only keeps the members roster current.
export function useRoom(
  code: string | null,
  accessToken: string | undefined,
  onLoad: (payload: RoomPayload) => void,
): UseRoomResult {
  const [connected, setConnected] = useState(false);
  const [members, setMembers] = useState<RoomMember[]>([]);
  // Tokens refresh about hourly; refs keep requests current without resubscribing.
  const token = useRef(accessToken);
  const onLoadRef = useRef(onLoad);
  useEffect(() => {
    token.current = accessToken;
    onLoadRef.current = onLoad;
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
        if (p?.days && Array.isArray(p.days)) onLoadRef.current(p);
        if (Array.isArray(data?.members)) setMembers(data.members);
        setConnected(true);
      })
      .catch(() => setConnected(false));
  }, [code]);

  useEffect(() => {
    if (!code || code === "LOCAL" || !hasToken) return;
    reload();
    if (!supabase) return;

    const channel = supabase
      .channel(`room-${code}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "rooms", filter: `code=eq.${code}` },
        ({ new: row }) => {
          const r = row as { members?: RoomMember[] };
          if (Array.isArray(r.members)) setMembers(r.members);
        },
      )
      .subscribe();

    return () => {
      supabase!.removeChannel(channel);
      setConnected(false);
    };
  }, [code, hasToken, reload]);

  return { connected, members, reload };
}
