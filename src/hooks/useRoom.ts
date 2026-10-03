import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { loadSnapshot, saveSnapshot, updateSnapshotPayload } from "@/lib/offline";
import type { Day, EventPlace, Extra, Idea, IdeaLink, RoomMember, Task, TripInfo, TripSpan } from "@/types";

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
  ideas?: Idea[];
  ideaPlaces?: string[];   // places for organizing ideas; unset = derived from the trip
  ideaLinks?: IdeaLink[];  // last "Analizar con Claude" result (free matches are computed live)
  ideaLinksAt?: string;    // ISO time of that analysis
  ideaLinksIds?: string[]; // ideas that analysis read (the others are "new")
  eventPlaces?: Record<string, EventPlace>; // trip map: where each activity happens, by event id
}

export type SaveState = "idle" | "saving" | "saved" | "error";

interface UseRoomResult {
  connected: boolean;
  // Set while the room couldn't be reached and the device's last copy is shown:
  // when that copy was taken (ISO).
  offlineSince: string | null;
  members: RoomMember[];
  saveState: SaveState;
  // Resolves true only when this payload reached the database. `force` saves even
  // right after a remote update (autosave skips that echo).
  save: (payload: RoomPayload, opts?: { force?: boolean }) => Promise<boolean>;
}

export function useRoom(
  code: string | null,
  onRemoteUpdate: (payload: RoomPayload) => void,
): UseRoomResult {
  const [connected, setConnected] = useState(false);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [offlineSince, setOfflineSince] = useState<string | null>(null);
  // Bumped when the network comes back, to load the room again.
  const [attempt, setAttempt] = useState(0);
  const skipSave = useRef(false);
  const lastUpdatedAt = useRef<string | null>(null);

  const save = useCallback(
    async (payload: RoomPayload, opts?: { force?: boolean }) => {
      if (!code || code === "LOCAL") return false;
      if (skipSave.current && !opts?.force) {
        skipSave.current = false;
        return false;
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
          return false;
        }

        if (!res.ok) {
          setSaveState("error");
          return false;
        }

        const data = await res.json();
        if (data?.updated_at) lastUpdatedAt.current = data.updated_at;
        updateSnapshotPayload(code, payload);
        setSaveState("saved");
        return true;
      } catch {
        setSaveState("error");
        return false;
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
          saveSnapshot(code, { payload: p, members: Array.isArray(data?.members) ? data.members : [] });
        }
        if (Array.isArray(data?.members)) {
          setMembers(data.members);
        }
        setOfflineSince(null);
        setConnected(true);
      })
      .catch(() => {
        // No network: show this device's last copy, read-only (autosave waits
        // for `connected`), and load the room again once the network is back.
        setConnected(false);
        const snap = loadSnapshot(code);
        if (!snap) return;
        skipSave.current = true;
        onRemoteUpdate(snap.payload);
        setMembers(snap.members);
        setOfflineSince(snap.savedAt);
      });

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
            saveSnapshot(code, { payload: r.payload, members: Array.isArray(r.members) ? r.members : loadSnapshot(code)?.members ?? [] });
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
  }, [code, attempt]);

  useEffect(() => {
    if (!offlineSince) return;
    const retry = () => setAttempt((n) => n + 1);
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, [offlineSince]);

  return { connected, offlineSince, members, saveState, save };
}
