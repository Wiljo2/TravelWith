import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useUserRooms } from "@/hooks/useUserRooms";
import { usePendingJoin } from "@/hooks/usePendingJoin";
import { LOCAL_MODE_ENABLED, LOCAL_ROOM_CODE } from "@/data/localMode";
import { isSandbox } from "@/data/localSandbox";
import { isOffline, lastSnapshotCode } from "@/lib/offline";
import { joinTrip } from "@/lib/joinTrip";

const JOIN_ERRORS = {
  notFound: "No encontramos ese viaje. Pide un enlace nuevo.",
  failed: "No se pudo entrar al viaje.",
  sandbox: "En modo local no hay viajes de otras personas a los que unirse.",
};

// What the gate shows about an invitation link: waiting for sign-in / joining, or why it failed.
export interface InviteState {
  pending: boolean;
  error: string | null;
  dismissError: () => void;
}

// Which trip (room) is open, plus the signed-in user and their trips.
export function useTripSession() {
  const [roomCode, setRoomCodeState] = useState<string | null>(null);

  // Auto-resume: a signed-in user lands straight in their most recent trip
  // (the list comes ordered by last_active_at, persisted in Supabase's
  // user_rooms, so this works across devices). The other trips are one tap
  // away in "Volver a mis viajes"; that explicit leave isn't undone by this,
  // since resumeAttempted stays true afterward.
  const auth = useAuth();
  const { user, session, loading: authLoading } = auth;
  const userRooms = useUserRooms(user, session?.access_token);
  const [resumeAttempted, setResumeAttempted] = useState(false);
  const loaded = !authLoading && !userRooms.roomsLoading;

  const { code: joinCode, invalid: invalidJoin, clear: clearJoin } = usePendingJoin();
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  // A signed-in user's invitation link opens its trip instead of the auto-resume.
  const inviteTakesOver = !!user && (!!joinCode || joining);

  // A trip this browser just joined that wasn't in the user's list (by link or code;
  // opening one from the list doesn't count). In memory, so a reload never welcomes again.
  const [joinedCode, setJoinedCode] = useState<string | null>(null);
  const knownRooms = userRooms.rooms;
  const markJoined = useCallback((code: string) => {
    if (!knownRooms.some((r) => r.room_code === code)) setJoinedCode(code);
  }, [knownRooms]);

  useEffect(() => {
    if (resumeAttempted || !loaded || inviteTakesOver) return;
    setResumeAttempted(true);
    // A broken invitation link stays on the gate to show its error.
    if (invalidJoin) return;
    // Without network, reopen the last trip this device saved, signed in or not.
    const offlineRoom = isOffline() ? lastSnapshotCode() : null;
    if (offlineRoom) setRoomCodeState(offlineRoom);
    else if (user && userRooms.rooms.length > 0) setRoomCodeState(userRooms.rooms[0].room_code);
  }, [resumeAttempted, loaded, inviteTakesOver, invalidJoin, user, userRooms.rooms]);

  // An invitation opened while signed out waits here until sign-in. Waiting for the
  // trip list too keeps the joined trip from being dropped when the list arrives.
  const { addRoom } = userRooms;
  useEffect(() => {
    if (!joinCode || !loaded || !user) return;
    clearJoin();
    if (isSandbox()) {
      setJoinError(JOIN_ERRORS.sandbox); // eslint-disable-line react-hooks/set-state-in-effect -- the sandbox has no other trips to join
      setResumeAttempted(true);
      return;
    }
    setJoining(true);
    void joinTrip(joinCode, session?.access_token).then((outcome) => {
      setJoining(false);
      setResumeAttempted(true);
      if (outcome === "notFound" || outcome === "failed") return setJoinError(JOIN_ERRORS[outcome]);
      if (outcome === "joined") {
        markJoined(joinCode);
        addRoom(joinCode, "member");
      }
      setRoomCodeState(joinCode);
    });
  }, [joinCode, loaded, user, session, clearJoin, addRoom, markJoined]);

  // `?local=1` boots straight into local mode, skipping sign-in and the
  // auto-resume above (which is what redirects a returning user into their room).
  useEffect(() => {
    if (!LOCAL_MODE_ENABLED) return;
    const params = new URLSearchParams(window.location.search);
    const local = params.get("local");
    if (local === null || local === "new") return;
    setResumeAttempted(true);
    setRoomCodeState(LOCAL_ROOM_CODE);
    // `?local=1&welcome` previews an invited person's welcome on the demo trip.
    if (params.has("welcome")) setJoinedCode(LOCAL_ROOM_CODE);
  }, []);

  const dismissError = useCallback(() => {
    setJoinError(null);
    clearJoin();
  }, [clearJoin]);

  // Opening or leaving a trip from the app retires an old invitation error.
  const setRoomCode = useCallback((code: string | null) => {
    dismissError();
    setRoomCodeState(code);
  }, [dismissError]);

  const invite: InviteState = {
    pending: !!joinCode || joining,
    error: joinError ?? (invalidJoin ? JOIN_ERRORS.notFound : null),
    dismissError,
  };

  return { roomCode, setRoomCode, resumeAttempted, localMode: roomCode === LOCAL_ROOM_CODE, auth, userRooms, invite, joinedCode, markJoined };
}
