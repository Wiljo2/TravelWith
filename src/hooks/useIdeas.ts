import { useCallback, useState } from "react";
import { apiFetch } from "@/lib/api";
import { canonicalUrl, classifyIdeaFields, detectPlatform, findIdeaUrls } from "@/utils/ideas";
import type { IdeaTextFields, PlaceIndex } from "@/utils/ideas";
import { tiktokVideoId } from "@/utils/ideaMedia";
import type { Idea, IdeaLink, IdeaMoment, IdeaPlanResult, IdeaSuggestion, RoomPayload } from "@/types";
import { applyToList, rowToIdea, type Row } from "@/utils/tripRows";

function rulesSuggestion(fields: IdeaTextFields, index: PlaceIndex): IdeaSuggestion | undefined {
  const { place, cat } = classifyIdeaFields(fields, index);
  return place || cat ? { place, cat, source: "rules" } : undefined;
}

type Meta = { url?: string; title?: string; author?: string; thumbnail?: string; tags?: string[]; transcript?: string } | null;

// Post data via the server: caption, author, thumbnail and, for TikTok, hashtags
// and the automatic transcript (TikTok blocks these requests from browsers).
async function fetchMetadata(roomCode: string, accessToken: string | undefined, idea: Idea): Promise<Meta> {
  return apiFetch(`/api/rooms/${roomCode}/oembed?url=${encodeURIComponent(idea.url)}`, accessToken)
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

export function useIdeas(roomCode: string | null, accessToken: string | undefined) {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  // Undefined = derive the places from the trip (see seedPlaces); set once edited.
  const [customPlaces, setCustomPlaces] = useState<string[] | undefined>();
  // Ideas whose caption is still being fetched (UI only, never persisted).
  const [loadingIds, setLoadingIds] = useState<Set<string>>(() => new Set());
  // Last "Analizar con Claude" result (where each idea fits the itinerary).
  const [planLinks, setPlanLinks] = useState<IdeaLink[] | undefined>();
  const [planLinksAt, setPlanLinksAt] = useState<string | undefined>();
  // Ideas that analysis actually read (with or without a link).
  const [planIdeaIds, setPlanIdeaIds] = useState<string[] | undefined>();

  // The ideas part of the room payload, in and out. Stable: safe in callbacks.
  // A missing field means "none": otherwise the previous room's ideas would stay
  // on screen (and be autosaved into this one), e.g. for rooms saved before ideas.
  const loadPayload = useCallback((p: RoomPayload) => {
    setIdeas(Array.isArray(p.ideas) ? p.ideas : []);
    setCustomPlaces(Array.isArray(p.ideaPlaces) ? p.ideaPlaces : undefined);
    setPlanLinks(Array.isArray(p.ideaLinks) ? p.ideaLinks : undefined);
    setPlanLinksAt(p.ideaLinksAt || undefined);
    setPlanIdeaIds(Array.isArray(p.ideaLinksIds) ? p.ideaLinksIds : undefined);
  }, []);
  const payload = { ideas, ideaPlaces: customPlaces, ideaLinks: planLinks, ideaLinksAt: planLinksAt, ideaLinksIds: planIdeaIds };

  // One idea as the server has it (trip channel or a lost conflict); null removes it.
  const applyRow = useCallback((id: string, row: Row | null) => {
    setIdeas((prev) => applyToList(prev, id, row, rowToIdea));
  }, []);

  // The idea settings from the trip header (rooms.idea_places / idea_plan).
  const applySettings = useCallback((header: Record<string, unknown>) => {
    if ("idea_places" in header) setCustomPlaces(Array.isArray(header.idea_places) ? (header.idea_places as string[]) : undefined);
    if (!("idea_plan" in header)) return;
    const plan = (header.idea_plan ?? {}) as Partial<RoomPayload>;
    setPlanLinks(Array.isArray(plan.ideaLinks) ? plan.ideaLinks : undefined);
    setPlanLinksAt(plan.ideaLinksAt || undefined);
    setPlanIdeaIds(Array.isArray(plan.ideaLinksIds) ? plan.ideaLinksIds : undefined);
  }, []);

  function savePlan(links: IdeaLink[], at: string, ideaIds: string[]) {
    setPlanLinks(links);
    setPlanLinksAt(at);
    setPlanIdeaIds(ideaIds);
  }

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

  // Claude's reading of each idea's place and type is applied right away: one
  // analysis updates both views. What a member set by hand stays as it is.
  function applyClaude(classes: IdeaPlanResult["classes"], places: string[]) {
    const byId = new Map(classes.map((c) => [c.ideaId, c]));
    setIdeas((prev) => prev.map((i) => {
      const c = byId.get(i.id);
      if (!c) return i;
      const place = c.place && places.includes(c.place) && !i.placeManual ? c.place : i.place;
      const cat = c.cat && !i.catManual ? c.cat : i.cat;
      const s = i.suggestion;
      const keep = (!place && s?.place) || (!cat && s?.cat);
      return { ...i, place, cat, suggestion: keep ? s : undefined };
    }));
  }

  // A place or type picked by hand: Claude's next analysis won't change it.
  function setPlaceByHand(id: string, place: string | undefined) {
    updateIdea(id, { place, placeManual: place ? true : undefined, suggestion: undefined });
  }
  function setCatByHand(id: string, cat: string | undefined) {
    updateIdea(id, { cat, catManual: cat ? true : undefined, suggestion: undefined });
  }
  // The idea's moment in the plan, by hand; undefined goes back to the analysis.
  function setMomentByHand(id: string, moment: IdeaMoment | undefined) {
    updateIdea(id, { moment });
  }

  // Adds every new link found in `text`; returns how many were added.
  function addFromText(text: string, note: string, addedBy: string | undefined, index: PlaceIndex): number {
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
      suggestion: rulesSuggestion({ note: trimmedNote }, index),
    }));
    if (created.length === 0) return 0;
    setIdeas((prev) => [...created, ...prev]);
    for (const idea of created) void loadMetadata(idea, index);
    return created.length;
  }

  // Fetches the post data in the background, then re-runs the rules with every
  // source. Resolves with the enriched idea, or null when nothing arrived.
  async function loadMetadata(idea: Idea, index: PlaceIndex): Promise<Idea | null> {
    if (!roomCode || (idea.platform !== "tiktok" && idea.platform !== "youtube")) return null;
    setLoadingIds((prev) => new Set(prev).add(idea.id));
    const meta = await fetchMetadata(roomCode, accessToken, idea);
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
        embedId: (meta.url && tiktokVideoId(meta.url)) || i.embedId,
        tags: meta.tags ?? i.tags,
        transcript: meta.transcript ?? i.transcript,
      };
      return mergeSuggestion(withMeta, rulesSuggestion(withMeta, index), true) ?? withMeta;
    };
    setIdeas((prev) => prev.map((i) => (i.id === idea.id ? enrich(i) : i)));
    return enrich(idea);
  }

  function refreshMetadata(id: string, index: PlaceIndex): Promise<Idea | null> {
    const idea = ideas.find((i) => i.id === id);
    return idea ? loadMetadata(idea, index) : Promise.resolve(null);
  }

  // Editing the note re-runs the rules from scratch for what isn't confirmed yet.
  function setNote(id: string, note: string, index: PlaceIndex) {
    setIdeas((prev) => prev.map((i) => {
      if (i.id !== id) return i;
      const withNote = { ...i, note: note.trim() || undefined, suggestion: undefined };
      const rules = rulesSuggestion(withNote, index);
      return mergeSuggestion(withNote, rules, false) ?? withNote;
    }));
  }

  // When the trip's places change (new activities, or a better place list), the
  // rules run again. Pending suggestions are replaced; a confirmed place that the
  // rules now read differently gets a suggestion to review, once per place list.
  function reclassify(index: PlaceIndex, placesKey: string) {
    setIdeas((prev) => {
      let changed = false;
      const next = prev.map((i) => {
        if (i.placesKey === placesKey || i.status === "discarded") return i;
        changed = true;
        // Claude read the whole video and the trip: the rules don't override it.
        if (i.suggestion?.source === "claude") return { ...i, placesKey };
        const rules = rulesSuggestion(i, index);
        const ai = i.suggestion?.source === "ai" ? i.suggestion : undefined;
        // Only ideas without a place get one suggested: the rest were placed by
        // Claude or by hand, and a second opinion would only add noise.
        const place = i.place ? undefined : rules?.place ?? ai?.place;
        const cat = i.cat ? undefined : rules?.cat ?? ai?.cat;
        const fromRules = (place && place === rules?.place) || (!place && cat && cat === rules?.cat);
        const suggestion: IdeaSuggestion | undefined = place || cat ? { place, cat, source: fromRules ? "rules" : "ai" } : undefined;
        return { ...i, placesKey, suggestion };
      });
      return changed ? next : prev;
    });
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
    ideas, loadingIds, customPlaces, setCustomPlaces, renamePlace,
    loadPayload, payload, planLinks, planLinksAt, planIdeaIds, savePlan, applyRow, applySettings,
    updateIdea, removeIdea, toggleVote, applyClaude, setPlaceByHand, setCatByHand, setMomentByHand, acceptAllSuggestions, addFromText, refreshMetadata, setNote, reclassify,
  };
}
