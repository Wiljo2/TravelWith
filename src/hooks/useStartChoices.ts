import { useCallback, useState } from "react";
import type { Tab } from "@/components/TabBar";
import type { ItinerarySheet } from "@/components/itinerary/ItineraryView";
import type { StartChoicesProps } from "@/components/onboarding/StartChoices";
import type { NewTrip } from "@/types";
import { firstPlanDraft } from "@/utils/assistantDraft";

interface StartChoicesOptions {
  roomCode: string | null;
  mobile: boolean;
  canUseAssistant: boolean;
  // Messages in the assistant chat: the starter draft is dropped once one is sent.
  chatLength: number;
  setActiveTab: (tab: Tab) => void;
  setSheet: (sheet: ItinerarySheet) => void;
  share: (text: string) => void;
}

interface CreatedTrip {
  code: string;
  trip: NewTrip;
  open: boolean;
  draft: { text: string; chatLength: number } | null;
}

// The start choices of a trip this browser just created (not one opened or joined).
export function useStartChoices({ roomCode, mobile, canUseAssistant, chatLength, setActiveTab, setSheet, share }: StartChoicesOptions) {
  const [created, setCreated] = useState<CreatedTrip | null>(null);
  const markCreated = useCallback((code: string, trip: NewTrip) => setCreated({ code, trip, open: true, draft: null }), []);
  const current = created?.code === roomCode ? created : null;
  const update = (patch: Partial<CreatedTrip>) => setCreated((c) => (c ? { ...c, ...patch } : c));
  const close = () => update({ open: false });

  function askAssistant(trip: NewTrip) {
    const people = 1 + (trip.travelers?.length ?? 0);
    update({ open: false, draft: { text: firstPlanDraft(trip, people), chatLength } });
    setActiveTab("calendar");
    if (mobile) setSheet("agent");
  }

  const choices: StartChoicesProps | null = current && {
    open: current.open,
    onClose: close,
    roomCode: current.code,
    tripName: current.trip.name,
    toVote: (current.trip.tasks ?? []).flatMap((t) => (t.decides ? [t.decides] : [])),
    onPasteLink: (text) => { close(); share(text); },
    onAskAssistant: canUseAssistant ? () => askAssistant(current.trip) : undefined,
  };
  const agentDraft = current?.draft && current.draft.chatLength === chatLength ? current.draft.text : undefined;

  return { markCreated, choices, agentDraft };
}
