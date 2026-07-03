import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { Day, Extra, RoomMember, Task, TripInfo, TripSpan } from "@/types";

export interface MockPerson {
  id: string;
  name: string;
}

export interface RoomPayload {
  days: Day[];
  extras: Extra[];
  exchangeRate: number;
  trip?: TripInfo;
  mockPeople?: MockPerson[];
  tripSpans?: TripSpan[];
  tasks?: Task[];
}

export type SaveState = "idle" | "saving" | "saved" | "error";

interface UseRoomResult {
  connected: boolean;
  members: RoomMember[];
  saveState: SaveState;
  save: (payload: RoomPayload) => void;
}

export function useRoom(
  code: string | null,
  onRemoteUpdate: (payload: RoomPayload) => void,
): UseRoomResult {
  const [connected, setConnected] = useState(false);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const skipSave = useRef(false);
  const lastUpdatedAt = useRef<string | null>(null);

  const save = useCallback(
    async (payload: RoomPayload) => {
      if (!code || code === "LOCAL") return;
      if (skipSave.current) {
        skipSave.current = false;
        return;
      }
      setSaveState("saving");
      try {
        const res = await fetch(`/api/rooms/${code}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, expectedUpdatedAt: lastUpdatedAt.current ?? undefined }),
        });

        if (res.status === 409) {
          // Someone else saved first — adopt their version instead of overwriting it.
          const data = await res.json();
          if (data?.payload?.days) {
            lastUpdatedAt.current = data.updated_at ?? null;
            skipSave.current = true;
            onRemoteUpdate(data.payload);
          }
          setSaveState("saved");
          return;
        }

        if (!res.ok) {
          setSaveState("error");
          return;
        }

        const data = await res.json();
        if (data?.updated_at) lastUpdatedAt.current = data.updated_at;
        setSaveState("saved");
      } catch {
        setSaveState("error");
      }
    },
    [code, onRemoteUpdate],
  );

  useEffect(() => {
    if (!code || code === "LOCAL") return;

    fetch(`/api/rooms/${code}`)
      .then((r) => r.json())
      .then((data) => {
        const p = data?.payload as RoomPayload | undefined;
        if (data?.updated_at) lastUpdatedAt.current = data.updated_at;
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
          const r = row as { payload: RoomPayload; members?: RoomMember[]; updated_at?: string };
          if (r.updated_at) lastUpdatedAt.current = r.updated_at;
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

  return { connected, members, saveState, save };
}
