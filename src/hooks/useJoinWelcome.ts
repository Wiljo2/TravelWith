import { useState } from "react";
import type { Tab } from "@/components/TabBar";
import type { JoinWelcomeProps } from "@/components/onboarding/JoinWelcome";
import { LOCAL_ROOM_CODE } from "@/data/localMode";
import { tripFacts, welcomeItems } from "@/utils/joinWelcome";
import type { Day, RoomMember, Task, TripInfo } from "@/types";

interface JoinWelcomeOptions {
  // The trip this browser just joined for the first time (see useTripSession).
  joinedCode: string | null;
  roomCode: string | null;
  // The open trip's data arrived from the server; until then the hooks may still hold
  // the previously opened trip's.
  loaded: boolean;
  me: string;
  trip: TripInfo | null;
  members: RoomMember[];
  placeholders: number;
  tasks: Task[];
  days: Day[];
  ideaCount: number;
  setActiveTab: (tab: Tab) => void;
}

// The welcome of a trip just joined by invitation, once its data is in; closing it
// (or following one of its actions) dismisses it for the rest of the page's life.
export function useJoinWelcome({
  joinedCode, roomCode, loaded, me, trip, members, placeholders, tasks, days, ideaCount, setActiveTab,
}: JoinWelcomeOptions): JoinWelcomeProps | null {
  const [closed, setClosed] = useState<string | null>(null);
  if (!roomCode || joinedCode !== roomCode) return null;
  // The local demo is seeded in memory, without a server load.
  const ready = roomCode === LOCAL_ROOM_CODE ? trip !== null : loaded;
  const close = () => setClosed(roomCode);

  return {
    open: ready && closed !== roomCode,
    onClose: close,
    tripName: trip?.name ?? null,
    facts: tripFacts(trip, tasks),
    travelers: { members, me, placeholders },
    items: welcomeItems({ tasks, days, ideas: ideaCount }),
    onOpen: (tab) => { close(); setActiveTab(tab); },
  };
}
