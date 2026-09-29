import { useState } from "react";
import { canonicalUrl, classifyIdeaFields, detectPlatform, findIdeaUrls } from "@/utils/ideas";
import type { IdeaTextFields, PlaceProfiles } from "@/utils/ideas";
import type { Idea, IdeaSuggestion } from "@/types";

function rulesSuggestion(fields: IdeaTextFields, profiles: PlaceProfiles): IdeaSuggestion | undefined {
  const { place, cat } = classifyIdeaFields(fields, profiles);
  return place || cat ? { place, cat, source: "rules" } : undefined;
}

type Meta = { title?: string; author?: string; thumbnail?: string; tags?: string[]; transcript?: string } | null;

// Post data via the server: caption, author, thumbnail and, for TikTok, hashtags
// and the automatic transcript (TikTok blocks these requests from browsers).
async function fetchMetadata(roomCode: string, idea: Idea): Promise<Meta> {
  return fetch(`/api/rooms/${roomCode}/oembed?url=${encodeURIComponent(idea.url)}`)
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
}

// Fills only what the group hasn't confirmed and a previous suggestion didn't cover.
function mergeSuggestion(idea: Idea, s: IdeaSuggestion | undefined, keepExisting: boolean): Idea | null {
  if (!s) return null;
  const current = keepExisting ? idea.suggestion : undefined;
  const addsPlace = !idea.place && !current?.place && s.place;
  const addsCat = !idea.cat && !current?.cat && s.cat;
  if (!addsPlace && !addsCat) return null;
  return {
    ...idea,
    suggestion: {
      place: idea.place ? undefined : current?.place ?? s.place,
      cat: idea.cat ? undefined : current?.cat ?? s.cat,
      source: s.source,
    },
  };
}

export function useIdeas(roomCode: string | null) {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  // Undefined = derive the places from the trip (see seedPlaces); set once edited.
  const [customPlaces, setCustomPlaces] = useState<string[] | undefined>();
  // Ideas whose caption is still being fetched (UI only, never persisted).
  const [loadingIds, setLoadingIds] = useState<Set<string>>(() => new Set());

  function updateIdea(id: string, patch: Partial<Idea>) {
    setIdeas((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }
  function removeIdea(id: string) {
    setIdeas((prev) => prev.filter((i) => i.id !== id));
  }
  function toggleVote(id: string, voter: string) {
    setIdeas((prev) => prev.map((i) => {
      if (i.id !== id) return i;
      const votes = i.votes ?? [];
      return { ...i, votes: votes.includes(voter) ? votes.filter((v) => v !== voter) : [...votes, voter] };
    }));
  }

  // AI suggestions only fill gaps: they never overwrite what the group confirmed,
  // nor a rules match (rules key off exact place names and keywords).
  // Returns how many ideas actually got something new.
  function applySuggestions(suggestions: Map<string, IdeaSuggestion>): number {
    const added = ideas.filter((i) => mergeSuggestion(i, suggestions.get(i.id), true)).length;
    setIdeas((prev) => prev.map((i) => mergeSuggestion(i, suggestions.get(i.id), true) ?? i));
    return added;
  }

  // Adds every new link found in `text`; returns how many were added.
  function addFromText(text: string, note: string, addedBy: string | undefined, profiles: PlaceProfiles): number {
    const known = new Set(ideas.map((i) => canonicalUrl(i.url)));
    const urls = findIdeaUrls(text).filter((u) => {
      const key = canonicalUrl(u);
      if (known.has(key)) return false;
      known.add(key);
      return true;
    });
    const trimmedNote = note.trim() || undefined;
    const created: Idea[] = urls.map((url) => ({
      id: crypto.randomUUID(),
      url,
      platform: detectPlatform(url),
      createdAt: new Date().toISOString(),
      note: trimmedNote,
      addedBy,
      status: "idea",
      suggestion: rulesSuggestion({ note: trimmedNote }, profiles),
    }));
    if (created.length === 0) return 0;
    setIdeas((prev) => [...created, ...prev]);
    for (const idea of created) void loadMetadata(idea, profiles);
    return created.length;
  }

  // Fetches the post data in the background, then re-runs the rules with every
  // source. Resolves with the enriched idea, or null when nothing arrived.
  async function loadMetadata(idea: Idea, profiles: PlaceProfiles): Promise<Idea | null> {
    if (!roomCode || (idea.platform !== "tiktok" && idea.platform !== "youtube")) return null;
    setLoadingIds((prev) => new Set(prev).add(idea.id));
    const meta = await fetchMetadata(roomCode, idea);
    setLoadingIds((prev) => {
      const next = new Set(prev);
      next.delete(idea.id);
      return next;
    });
    if (!meta?.title && !meta?.thumbnail) return null;
    const enrich = (i: Idea): Idea => {
      const withMeta: Idea = {
        ...i,
        title: meta.title,
        author: meta.author,
        thumbnail: meta.thumbnail,
        tags: meta.tags ?? i.tags,
        transcript: meta.transcript ?? i.transcript,
      };
      return mergeSuggestion(withMeta, rulesSuggestion(withMeta, profiles), true) ?? withMeta;
    };
    setIdeas((prev) => prev.map((i) => (i.id === idea.id ? enrich(i) : i)));
    return enrich(idea);
  }

  function refreshMetadata(id: string, profiles: PlaceProfiles): Promise<Idea | null> {
    const idea = ideas.find((i) => i.id === id);
    return idea ? loadMetadata(idea, profiles) : Promise.resolve(null);
  }

  // Editing the note re-runs the rules from scratch for what isn't confirmed yet.
  function setNote(id: string, note: string, profiles: PlaceProfiles) {
    setIdeas((prev) => prev.map((i) => {
      if (i.id !== id) return i;
      const withNote = { ...i, note: note.trim() || undefined, suggestion: undefined };
      const rules = rulesSuggestion(withNote, profiles);
      return mergeSuggestion(withNote, rules, false) ?? withNote;
    }));
  }

  // "Aceptar todas": confirms every pending suggestion at once.
  function acceptAllSuggestions() {
    setIdeas((prev) => prev.map((i) => {
      const s = i.suggestion;
      if (!s?.place && !s?.cat) return i;
      return { ...i, place: s.place ?? i.place, cat: s.cat ?? i.cat, suggestion: undefined };
    }));
  }

  // Renaming or removing a place keeps ideas consistent.
  function renamePlace(from: string, to: string | undefined) {
    setIdeas((prev) => prev.map((i) => {
      const place = i.place === from ? to : i.place;
      const sPlace = i.suggestion?.place === from ? to : i.suggestion?.place;
      return place === i.place && sPlace === i.suggestion?.place
        ? i
        : { ...i, place, suggestion: i.suggestion && { ...i.suggestion, place: sPlace } };
    }));
  }

  return {
    ideas, setIdeas, loadingIds, customPlaces, setCustomPlaces, renamePlace,
    updateIdea, removeIdea, toggleVote, applySuggestions, acceptAllSuggestions, addFromText, refreshMetadata, setNote,
  };
}
