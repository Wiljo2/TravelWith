import type { EventPlace, Idea, IdeaLink, TripDocument } from "@/types";
import type { TripTable } from "@/utils/tripRows";

// Ideas, Drive documents, map places and the idea settings are edited by many
// small functions (votes, classification, renames, locating). Instead of an op
// per function, the client compares each collection with what the server last
// confirmed and sends the ops for the difference.

export interface IdeaPlan {
  ideaLinks?: IdeaLink[];
  ideaLinksAt?: string;
  ideaLinksIds?: string[];
}

export interface FeatureState {
  ideas: Idea[];
  documents: TripDocument[];
  eventPlaces: Record<string, EventPlace>;
  ideaPlaces: string[] | undefined;
  ideaPlan: IdeaPlan | null;
}

export interface Synced {
  ideas: Map<string, string>;
  documents: Map<string, string>;
  places: Map<string, string>;
  settings: string;
}

export interface FeatureOp {
  op: string;
  args: Record<string, unknown>;
}

// Stable JSON without versions: key order and row metadata never count as a change.
export function contentKey(value: unknown): string {
  const norm = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(norm);
    if (v && typeof v === "object") {
      return Object.fromEntries(
        Object.keys(v).filter((k) => k !== "version" && (v as Record<string, unknown>)[k] !== undefined).sort()
          .map((k) => [k, norm((v as Record<string, unknown>)[k])]),
      );
    }
    return v;
  };
  return JSON.stringify(norm(value));
}

const settingsKey = (s: Pick<FeatureState, "ideaPlaces" | "ideaPlan">) => contentKey({ ideaPlaces: s.ideaPlaces ?? null, ideaPlan: s.ideaPlan });

export function snapshot(state: FeatureState): Synced {
  return {
    ideas: new Map(state.ideas.map((i) => [i.id, contentKey(i)])),
    documents: new Map(state.documents.map((d) => [d.id, contentKey(d)])),
    places: new Map(Object.entries(state.eventPlaces).map(([id, p]) => [id, contentKey(p)])),
    settings: settingsKey(state),
  };
}

const omitVersion = <T extends { version?: number }>({ version: _version, ...rest }: T) => rest;

export function diffOps(prev: Synced, next: FeatureState): FeatureOp[] {
  const ops: FeatureOp[] = [];

  for (const idea of next.ideas) {
    const key = contentKey(idea);
    if (!prev.ideas.has(idea.id)) ops.push({ op: "idea.create", args: { id: idea.id, idea: omitVersion(idea) } });
    else if (prev.ideas.get(idea.id) !== key) ops.push({ op: "idea.update", args: { id: idea.id, idea: omitVersion(idea) } });
  }
  const ideaIds = new Set(next.ideas.map((i) => i.id));
  for (const id of prev.ideas.keys()) if (!ideaIds.has(id)) ops.push({ op: "idea.delete", args: { id } });

  for (const doc of next.documents) {
    if (!prev.documents.has(doc.id)) {
      ops.push({ op: "document.create", args: { id: doc.id, driveFileId: doc.driveFileId, title: doc.title, ...(doc.kind ? { kind: doc.kind } : {}) } });
    } else if (prev.documents.get(doc.id) !== contentKey(doc)) {
      ops.push({ op: "document.update", args: { id: doc.id, title: doc.title, kind: doc.kind ?? "other" } });
    }
  }
  const docIds = new Set(next.documents.map((d) => d.id));
  for (const id of prev.documents.keys()) if (!docIds.has(id)) ops.push({ op: "document.delete", args: { id } });

  const places: Record<string, EventPlace | null> = {};
  for (const [id, place] of Object.entries(next.eventPlaces)) {
    if (prev.places.get(id) !== contentKey(place)) places[id] = omitVersion(place);
  }
  for (const id of prev.places.keys()) if (!(id in next.eventPlaces)) places[id] = null;
  if (Object.keys(places).length) ops.push({ op: "eventPlace.set", args: { places } });

  if (prev.settings !== settingsKey(next)) {
    ops.push({ op: "trip.setIdeaSettings", args: { ideaPlaces: next.ideaPlaces ?? null, ideaPlan: next.ideaPlan } });
  }
  return ops;
}

// Records what the server now holds for one row (load, broadcast, lost conflict).
export function markRow(synced: Synced, table: TripTable, id: string, item: object | null) {
  const map = table === "trip_ideas" ? synced.ideas : table === "trip_documents" ? synced.documents : table === "trip_event_places" ? synced.places : null;
  if (!map) return;
  if (item) map.set(id, contentKey(item));
  else map.delete(id);
}

export function markSettings(synced: Synced, settings: Pick<FeatureState, "ideaPlaces" | "ideaPlan">) {
  synced.settings = settingsKey(settings);
}

// The analysis fields as stored in rooms.idea_plan; null when there is none.
export function ideaPlanOf(links: IdeaLink[] | undefined, at: string | undefined, ids: string[] | undefined): IdeaPlan | null {
  if (links === undefined && at === undefined && ids === undefined) return null;
  return {
    ...(links !== undefined ? { ideaLinks: links } : {}),
    ...(at !== undefined ? { ideaLinksAt: at } : {}),
    ...(ids !== undefined ? { ideaLinksIds: ids } : {}),
  };
}
