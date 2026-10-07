import { describe, expect, it } from "vitest";
import { contentKey, diffOps, ideaPlanOf, markRow, markSettings, snapshot, type FeatureState } from "@/utils/featureSync";
import { rowToDocument, rowToEventPlace, rowToIdea } from "@/utils/tripRows";
import { parseTripMessage } from "@/utils/tripChannel";
import type { Idea } from "@/types";

const idea = (over: Partial<Idea> = {}): Idea => ({ id: "i1", url: "https://youtu.be/x", platform: "youtube", createdAt: "2026-10-01T00:00:00Z", ...over });

const base = (): FeatureState => ({
  ideas: [idea({ version: 2 })],
  documents: [{ id: "doc1", driveFileId: "1AbC_dEf-123456789xyz", title: "Vuelo", kind: "flight", version: 1 }],
  eventPlaces: { e1: { key: "Museo|", kind: "place", lat: 25.7, lng: -80.1, version: 1 } },
  ideaPlaces: ["Miami"],
  ideaPlan: ideaPlanOf([], "2026-10-03T00:00:00Z", ["i1"]),
});

describe("feature sync", () => {
  it("sends nothing when only versions or key order differ", () => {
    const loaded = base();
    const same: FeatureState = {
      ...loaded,
      ideas: [{ createdAt: "2026-10-01T00:00:00Z", platform: "youtube", url: "https://youtu.be/x", id: "i1", version: 7 }],
      eventPlaces: { e1: { lng: -80.1, lat: 25.7, kind: "place", key: "Museo|" } },
    };
    expect(diffOps(snapshot(loaded), same)).toEqual([]);
  });

  it("creates, updates and deletes ideas and documents", () => {
    const synced = snapshot(base());
    const next = base();
    next.ideas = [idea({ status: "planned", version: 2 }), idea({ id: "i2", url: "https://x" })];
    next.documents = [];
    expect(diffOps(synced, next)).toEqual([
      { op: "idea.update", args: { id: "i1", idea: idea({ status: "planned" }) } },
      { op: "idea.create", args: { id: "i2", idea: idea({ id: "i2", url: "https://x" }) } },
      { op: "document.delete", args: { id: "doc1" } },
    ]);
  });

  it("sends map places in one batch, with null for removed ones", () => {
    const synced = snapshot(base());
    const next = base();
    next.eventPlaces = { e2: { key: "Playa|", kind: "place" } };
    expect(diffOps(synced, next)).toEqual([
      { op: "eventPlace.set", args: { places: { e2: { key: "Playa|", kind: "place" }, e1: null } } },
    ]);
  });

  it("sends the idea settings when the places or the analysis change", () => {
    const synced = snapshot(base());
    const next = { ...base(), ideaPlaces: undefined };
    expect(diffOps(synced, next)).toEqual([
      { op: "trip.setIdeaSettings", args: { ideaPlaces: null, ideaPlan: base().ideaPlan } },
    ]);
  });

  it("rows confirmed from the server are not sent back", () => {
    const synced = snapshot(base());
    const remote = idea({ status: "discarded", version: 3 });
    markRow(synced, "trip_ideas", "i1", remote);
    markRow(synced, "trip_documents", "doc1", null);
    markSettings(synced, { ideaPlaces: ["Miami", "Orlando"], ideaPlan: base().ideaPlan });
    const next = { ...base(), ideas: [remote], documents: [], ideaPlaces: ["Miami", "Orlando"] };
    expect(diffOps(synced, next)).toEqual([]);
  });

  it("keeps only the analysis fields that exist", () => {
    expect(ideaPlanOf(undefined, undefined, undefined)).toBeNull();
    expect(ideaPlanOf(undefined, "t", undefined)).toEqual({ ideaLinksAt: "t" });
    expect(contentKey({ b: 1, a: undefined, version: 3 })).toBe('{"b":1}');
  });
});

describe("rows of the new tables", () => {
  it("turn into the client shapes", () => {
    expect(rowToIdea({ id: "i1", version: 4, data: { url: "https://x", votes: ["u1"] } })).toEqual({ url: "https://x", votes: ["u1"], id: "i1", version: 4 });
    expect(rowToDocument({ id: "doc1", version: 2, drive_file_id: "1AbC_dEf-123456789xyz", title: "Vuelo", kind: null })).toEqual({
      id: "doc1", driveFileId: "1AbC_dEf-123456789xyz", title: "Vuelo", kind: undefined, version: 2,
    });
    expect(rowToEventPlace({ id: "e1", version: 3, data: { key: "k", kind: "ship" } })).toEqual({ key: "k", kind: "ship", version: 3 });
  });

  it("arrive over the trip channel", () => {
    const message = parseTripMessage({ operation: "UPDATE", table: "trip_ideas", schema: "public", record: { id: "i1", version: 2, data: {} } });
    expect(message).toMatchObject({ kind: "row", table: "trip_ideas", id: "i1", version: 2 });
    expect(parseTripMessage({ operation: "DELETE", table: "trip_event_places", record: null, old_record: { id: "e1", version: 1 } })).toMatchObject({ table: "trip_event_places", row: null });
  });
});
