"use client";
import { useEffect, useMemo } from "react";
import type { User } from "@supabase/supabase-js";
import IdeasView from "@/components/ideas/IdeasView";
import { useFreshThumbnails } from "@/hooks/useFreshThumbnails";
import { CLASSIFIER_VERSION, placeIndex } from "@/utils/ideas";
import { isVenue, tripPlaces } from "@/utils/places";
import type { useIdeas } from "@/hooks/useIdeas";
import type { RoomPayload } from "@/hooks/useRoom";
import type { Day, IdeaLink, IdeaPlanResult, TripInfo } from "@/types";

interface IdeasTabProps {
  api: ReturnType<typeof useIdeas>;
  roomCode: string;
  localMode: boolean;
  mobile: boolean;
  user: User | null;
  days: Day[];
  trip: TripInfo | null;
  // The full room payload right now, and the way to persist it immediately.
  currentPayload: () => RoomPayload;
  save: (payload: RoomPayload, opts?: { force?: boolean }) => Promise<boolean>;
}

// Wires the Ideas board to the room: the trip's places, who is voting/adding,
// and the server call behind "Analizar con Claude".
export default function IdeasTab({ api, roomCode, localMode, mobile, user, days, trip, currentPayload, save }: IdeasTabProps) {
  const { customPlaces, reclassify } = api;
  const index = useMemo(
    () => placeIndex(tripPlaces(trip?.destination, days, customPlaces), days),
    [trip?.destination, days, customPlaces],
  );
  const areas = index.places.filter((p) => !isVenue(p)).map((p) => p.name);
  // Re-run the rules on existing ideas when the places or the rules change.
  const placesKey = `v${CLASSIFIER_VERSION}|${index.places.map((p) => p.name).join("|")}`;
  useEffect(() => { reclassify(index, placesKey); }, [placesKey, api.ideas.length]); // eslint-disable-line react-hooks/exhaustive-deps -- keyed by the place list
  // Expired TikTok covers are renewed in the background, for the whole group.
  useFreshThumbnails(roomCode, api.ideas, (id, thumbnail) => api.updateIdea(id, { thumbnail }));
  const voter = user?.id ?? "local";
  const addedBy = user ? String(user.user_metadata?.full_name ?? user.email ?? "").split(" ")[0] || undefined : undefined;

  // The server reads the saved room (so save first, and stop if that fails: it
  // would analyze a room without the new ideas); the local demo room isn't in
  // the database and sends its data inline.
  async function analyze(ideaIds?: string[]) {
    const payload = currentPayload();
    if (!localMode && !(await save(payload, { force: true }))) {
      throw new Error("No se pudo guardar el viaje (quizá otro miembro lo cambió). Intenta de nuevo.");
    }
    const res = await fetch(`/api/rooms/${roomCode}/idea-plan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ideaIds, payload: localMode ? payload : undefined }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !Array.isArray(data?.links)) throw new Error(data?.error ?? "No se pudo analizar");
    return {
      links: data.links as IdeaLink[],
      classes: (data.classes ?? []) as IdeaPlanResult["classes"],
      at: data.at as string,
      ideaIds: (data.ideaIds ?? []) as string[],
    };
  }

  return (
    <IdeasView
      ideas={api.ideas}
      index={index}
      roomCode={roomCode}
      loadingIds={api.loadingIds}
      mobile={mobile}
      voter={voter}
      onAdd={(text, note) => api.addFromText(text, note, addedBy, index)}
      onUpdate={api.updateIdea}
      onSetPlace={api.setPlaceByHand}
      onSetCat={api.setCatByHand}
      onRemove={api.removeIdea}
      onVote={(id) => api.toggleVote(id, voter)}
      onApplyClaude={(classes) => api.applyClaude(classes, index.places.map((p) => p.name))}
      onAcceptAll={api.acceptAllSuggestions}
      onSetNote={(id, note) => api.setNote(id, note, index)}
      onRetry={(id) => api.refreshMetadata(id, index)}
      onAddPlace={(place) => api.setCustomPlaces([...areas, place])}
      onRemovePlace={(place) => { api.setCustomPlaces(areas.filter((p) => p !== place)); api.renamePlace(place, undefined); }}
      days={days}
      planLinks={api.planLinks}
      planLinksAt={api.planLinksAt}
      planIdeaIds={api.planIdeaIds}
      onAnalyze={analyze}
      onSavePlan={api.savePlan}
    />
  );
}
