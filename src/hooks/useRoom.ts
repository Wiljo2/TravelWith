import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import type { RoomMember, RoomPayload } from "@/types";

export type { MockPerson, RoomPayload } from "@/types";

export type SaveState = "idle" | "saving" | "saved" | "error";

interface UseRoomResult {
  connected: boolean;
  members: RoomMember[];
  saveState: SaveState;
  // Resolves true only when this payload reached the database. `force` saves even
  // right after a remote update (autosave skips that echo).
  save: (payload: RoomPayload, opts?: { force?: boolean }) => Promise<boolean>;
}

export function useRoom(
  code: string | null,
  accessToken: string | undefined,
  onRemoteUpdate: (payload: RoomPayload) => void,
): UseRoomResult {
  const [connected, setConnected] = useState(false);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const skipSave = useRef(false);
  const lastUpdatedAt = useRef<string | null>(null);
  // Tokens refresh about hourly; a ref keeps saves current without resubscribing.
  const token = useRef(accessToken);
  useEffect(() => {
    token.current = accessToken;
  }, [accessToken]);
  const hasToken = !!accessToken;

  const save = useCallback(
    async (payload: RoomPayload, opts?: { force?: boolean }) => {
      if (!code || code === "LOCAL") return false;
      if (skipSave.current && !opts?.force) {
        skipSave.current = false;
        return false;
      }
      setSaveState("saving");
      try {
        const res = await apiFetch(`/api/rooms/${code}`, token.current, {
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
    if (!code || code === "LOCAL" || !hasToken) return;

    apiFetch(`/api/rooms/${code}`, token.current)
      .then((r) => {
        if (!r.ok) throw new Error(`GET room ${r.status}`);
        return r.json();
      })
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
          // Roster-only changes (join/leave) keep updated_at: don't reload the
          // payload, or pending local edits would be replaced by the stored copy.
          const payloadChanged = !r.updated_at || r.updated_at !== lastUpdatedAt.current;
          if (r.updated_at) lastUpdatedAt.current = r.updated_at;
          if (payloadChanged && r.payload?.days && Array.isArray(r.payload.days)) {
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
  }, [code, hasToken]);

  return { connected, members, saveState, save };
}
