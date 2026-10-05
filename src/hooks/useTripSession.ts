import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useUserRooms } from "@/hooks/useUserRooms";
import { LOCAL_MODE_ENABLED, LOCAL_ROOM_CODE } from "@/data/localMode";
import { isOffline, lastSnapshotCode } from "@/lib/offline";

// Which trip (room) is open, plus the signed-in user and their trips.
export function useTripSession() {
  const [roomCode, setRoomCode] = useState<string | null>(null);

  // Auto-resume: a signed-in user lands straight in their most recent trip
  // (the list comes ordered by last_active_at, persisted in Supabase's
  // user_rooms, so this works across devices). The other trips are one tap
  // away in "Volver a mis viajes"; that explicit leave isn't undone by this,
  // since resumeAttempted stays true afterward.
  const auth = useAuth();
  const { user, session, loading: authLoading } = auth;
  const userRooms = useUserRooms(user, session?.access_token);
  const [resumeAttempted, setResumeAttempted] = useState(false);

  useEffect(() => {
    if (resumeAttempted) return;
    if (authLoading || userRooms.roomsLoading) return;
    setResumeAttempted(true);
    // Without network, reopen the last trip this device saved, signed in or not.
    const offlineRoom = isOffline() ? lastSnapshotCode() : null;
    if (offlineRoom) setRoomCode(offlineRoom);
    else if (user && userRooms.rooms.length > 0) setRoomCode(userRooms.rooms[0].room_code);
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
