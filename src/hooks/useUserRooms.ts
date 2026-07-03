import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";
import type { TripInfo } from "@/types";

export interface UserRoom {
  room_code: string;
  role: string;
  joined_at: string;
  name: string | null;
  trip: TripInfo | null;
}

export function useUserRooms(user: User | null, accessToken: string | undefined) {
  const [rooms, setRooms] = useState<UserRoom[]>([]);

  useEffect(() => {
    if (!user || !accessToken) {
      setRooms([]);
      return;
    }
    fetch("/api/rooms/list", { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => (r.ok ? r.json() : []))
      .then((items: { code: string; name: string | null; role: string; joined_at: string; trip: TripInfo | null }[]) => {
        setRooms(items.map((i) => ({
          room_code: i.code,
          role: i.role,
          joined_at: i.joined_at,
          name: i.name,
          trip: i.trip,
        })));
      })
      .catch(() => setRooms([]));
  }, [user, accessToken]);

  async function addRoom(code: string, role: "owner" | "member" = "member", name: string | null = null) {
    if (!user || !supabase) return;
    await supabase.from("user_rooms").upsert(
      { user_id: user.id, room_code: code, role },
      { onConflict: "user_id,room_code" },
    );
    setRooms((prev) => {
      if (prev.some((r) => r.room_code === code)) return prev;
      return [{ room_code: code, role, joined_at: new Date().toISOString(), name, trip: null }, ...prev];
    });
  }

  // Uses the server-side API (service role key) to bypass RLS
  async function removeRoom(code: string, accessToken: string) {
    await fetch(`/api/rooms/${code}/members`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    setRooms((prev) => prev.filter((r) => r.room_code !== code));
  }

  return { rooms, addRoom, removeRoom };
}
