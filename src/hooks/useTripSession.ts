import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useUserRooms } from "@/hooks/useUserRooms";
import { LOCAL_MODE_ENABLED, LOCAL_ROOM_CODE } from "@/data/localMode";

// Which trip (room) is open, plus the signed-in user and their trips.
export function useTripSession() {
  const [roomCode, setRoomCode] = useState<string | null>(null);

  // Auto-resume: the user↔room relation (last_active_at) is persisted in
  // Supabase (user_rooms), not localStorage, so this works across devices.
  // Only auto-enters when there's a SINGLE trip — no ambiguity to resolve.
  // With multiple trips, RoomGate's "Mis viajes" list is shown instead so the
  // user can see and pick among all of them (auto-jumping to just one would
  // hide the rest). A later explicit "leave" (onLeaveRoom) won't be undone by
  // this, since resumeAttempted stays true afterward.
  const auth = useAuth();
  const { user, session, loading: authLoading } = auth;
  const userRooms = useUserRooms(user, session?.access_token);
  const [resumeAttempted, setResumeAttempted] = useState(false);

  useEffect(() => {
    if (resumeAttempted) return;
    if (authLoading || userRooms.roomsLoading) return;
    setResumeAttempted(true);
    if (user && userRooms.rooms.length === 1) setRoomCode(userRooms.rooms[0].room_code);
  }, [resumeAttempted, authLoading, userRooms.roomsLoading, user, userRooms.rooms]);

  // `?local=1` boots straight into local mode, skipping sign-in and the
  // auto-resume above (which is what redirects a returning user into their room).
  useEffect(() => {
    if (!LOCAL_MODE_ENABLED) return;
    if (!new URLSearchParams(window.location.search).has("local")) return;
    setResumeAttempted(true);
    setRoomCode(LOCAL_ROOM_CODE);
  }, []);

  return { roomCode, setRoomCode, resumeAttempted, localMode: roomCode === LOCAL_ROOM_CODE, auth, userRooms };
}
