import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import type { TripInfo } from "@/types";
import { apiFetch } from "@/lib/api";
import { loadRoomList, saveRoomList } from "@/lib/offline";

export interface UserRoom {
  room_code: string;
  role: string;
  joined_at: string;
  last_active_at: string;
  name: string | null;
  trip: TripInfo | null;
}

// The user↔room relation (role, last_active_at) is persisted server-side by
// POST /api/rooms/[code]/members — this hook only reads it and reflects
// optimistic local updates; it never writes to Supabase directly.
export function useUserRooms(user: User | null, accessToken: string | undefined) {
  const [rooms, setRooms] = useState<UserRoom[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(true);
  // Whose list `rooms` is (null = signed out). Until it matches the current
  // user the list counts as loading: right after sign-in is confirmed, the
  // signed-out empty list would otherwise read as "no trips" for a render.
  const [listOwner, setListOwner] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (!user || !accessToken) {
      setRooms([]);
      setRoomsLoading(false);
      setListOwner(null);
      return;
    }
    setRoomsLoading(true);
    apiFetch("/api/rooms/list", accessToken)
      .then((r) => (r.ok ? r.json() : []))
      .then((items: { code: string; name: string | null; role: string; joined_at: string; last_active_at: string; trip: TripInfo | null }[]) => {
        const list = items.map((i) => ({
          room_code: i.code,
          role: i.role,
          joined_at: i.joined_at,
          last_active_at: i.last_active_at,
          name: i.name,
          trip: i.trip,
        }));
        setRooms(list);
        saveRoomList(user.id, list);
      })
      // Offline: the list this device saw last, so a trip can still be opened.
      .catch(() => setRooms(loadRoomList<UserRoom>(user.id)))
      .finally(() => { setRoomsLoading(false); setListOwner(user.id); });
  }, [user, accessToken]);

  // Optimistic UI update after POST /members succeeds server-side. Moves the
  // room to the front, matching the server's last_active_at desc ordering.
  function addRoom(code: string, role: "owner" | "member" = "member", name: string | null = null) {
    setRooms((prev) => {
      const existing = prev.find((r) => r.room_code === code);
      const rest = prev.filter((r) => r.room_code !== code);
      const nowIso = new Date().toISOString();
      return [{
        room_code: code,
        role: existing?.role ?? role,
        joined_at: existing?.joined_at ?? nowIso,
        last_active_at: nowIso,
        name: existing?.name ?? name,
        trip: existing?.trip ?? null,
      }, ...rest];
    });
  }

  // Uses the server-side API (service role key) to bypass RLS
  async function removeRoom(code: string, accessToken: string) {
    await apiFetch(`/api/rooms/${code}/members`, accessToken, { method: "DELETE" });
    setRooms((prev) => prev.filter((r) => r.room_code !== code));
  }

  return { rooms, roomsLoading: roomsLoading || listOwner !== (user?.id ?? null), addRoom, removeRoom };
}
