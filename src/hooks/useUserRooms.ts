import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { User } from "@supabase/supabase-js";

export interface UserRoom {
  room_code: string;
  role: string;
  joined_at: string;
}

export function useUserRooms(user: User | null) {
  const [rooms, setRooms] = useState<UserRoom[]>([]);

  useEffect(() => {
    if (!user || !supabase) {
      setRooms([]);
      return;
    }
    supabase
      .from("user_rooms")
      .select("room_code, role, joined_at")
      .order("joined_at", { ascending: false })
      .then(({ data }) => setRooms(data ?? []));
  }, [user]);

  async function addRoom(code: string, role: "owner" | "member" = "member") {
    if (!user || !supabase) return;
    await supabase.from("user_rooms").upsert(
      { user_id: user.id, room_code: code, role },
      { onConflict: "user_id,room_code" },
    );
    setRooms((prev) => {
      if (prev.some((r) => r.room_code === code)) return prev;
      return [{ room_code: code, role, joined_at: new Date().toISOString() }, ...prev];
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
