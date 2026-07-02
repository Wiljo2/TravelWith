import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import type { Day, Extra, RoomMember, Task, TripSpan } from "../types";

export interface MockPerson {
  id: string;
  name: string;
}

export interface RoomPayload {
  days: Day[];
  extras: Extra[];
  exchangeRate: number;
  mockPeople?: MockPerson[];
  tripSpans?: TripSpan[];
  tasks?: Task[];
}

interface UseRoomResult {
  connected: boolean;
  members: RoomMember[];
  save: (payload: RoomPayload) => void;
}

export function useRoom(
  code: string | null,
  onRemoteUpdate: (payload: RoomPayload) => void,
): UseRoomResult {
  const [connected, setConnected] = useState(false);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const skipSave = useRef(false);

  const save = useCallback(
    async (payload: RoomPayload) => {
      if (!code || code === "LOCAL") return;
      if (skipSave.current) {
        skipSave.current = false;
        return;
      }
      await fetch(`/api/rooms/${code}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    },
    [code],
  );

  useEffect(() => {
    if (!code || code === "LOCAL") return;

    fetch(`/api/rooms/${code}`)
      .then((r) => r.json())
      .then((data) => {
        const p = data?.payload as RoomPayload | undefined;
        if (p?.days && Array.isArray(p.days)) {
          skipSave.current = true;
          onRemoteUpdate(p);
        }
        if (Array.isArray(data?.members)) {
          setMembers(data.members);
        }
        setConnected(true);
      })
      .catch(() => setConnected(false));

    if (!supabase) return;

    const channel = supabase
      .channel(`room-${code}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "rooms", filter: `code=eq.${code}` },
        ({ new: row }) => {
          const r = row as { payload: RoomPayload; members?: RoomMember[] };
          if (r.payload?.days && Array.isArray(r.payload.days)) {
            skipSave.current = true;
            onRemoteUpdate(r.payload);
          }
          if (Array.isArray(r.members)) {
            setMembers(r.members);
          }
        },
      )
      .subscribe();

    return () => {
      supabase!.removeChannel(channel);
      setConnected(false);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  return { connected, members, save };
}
