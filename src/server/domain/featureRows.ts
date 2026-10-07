import { LIMITS } from "@/constants/limits";
import { DomainError, checkArgs, checkClientId } from "@/server/domain/core";
import { validateDriveFileId, validateKind, validateTitle } from "@/server/domain/documents";
import type { NewRow, RowPatch } from "@/server/repo/core";
import type { Json } from "@/types/database";
import { uid } from "@/utils/uid";

// Pure validation for the data main added (relational plan, step 3.14):
// Drive documents, ideas, trip map places, the idea settings, and the Maps
// link / document reference on activities and expenses. Sizes mirror the
// checks in 018_main_features_tables.sql.

const IDEA_BYTES = 65536;
const PLACE_BYTES = 8192;
const IDEA_PLAN_BYTES = 262144;
export const MAX_PLACES_PER_OP = 500;

type Args = Record<string, unknown>;

const jsonBytes = (v: unknown) => new TextEncoder().encode(JSON.stringify(v)).length;
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

// undefined = not sent; null or "" = clear.
export function mapsUrlArg(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string" || !/^https:\/\//.test(value) || value.length > LIMITS.note) {
    throw new DomainError("mapsUrl must be an https link");
  }
  return value;
}

export function documentRefArg(value: unknown): string | null | undefined {
  if (value === undefined || value === null) return value;
  if (typeof value !== "string" || !value || value.length > LIMITS.id) throw new DomainError("documentId must be an id");
  return value;
}

export function newDocumentRow(args: unknown, position: number): NewRow<"trip_documents"> {
  checkArgs(args, {
    id: { type: "string" },
    driveFileId: { type: "string", required: true, max: LIMITS.id },
    title: { type: "string", required: true, max: LIMITS.documentTitle },
    kind: { type: "string", max: LIMITS.id },
  });
  const a = args as Args;
  validateDriveFileId(a.driveFileId as string);
  const kind = (a.kind as string | undefined) ?? "other";
  validateKind(kind);
  return {
    id: a.id === undefined ? uid() : checkClientId(a.id),
    position,
    drive_file_id: a.driveFileId as string,
    title: validateTitle(a.title as string),
    kind,
  };
}

// The Drive file of a document never changes; only its title and kind.
export function documentPatch(args: unknown): RowPatch<"trip_documents"> {
  checkArgs(args, {
    id: { type: "string", required: true },
    title: { type: "string", max: LIMITS.documentTitle },
    kind: { type: "string", max: LIMITS.id },
  });
  const a = args as Args;
  const patch: RowPatch<"trip_documents"> = {};
  if (a.title !== undefined) patch.title = validateTitle(a.title as string);
  if (a.kind !== undefined) {
    validateKind(a.kind as string);
    patch.kind = a.kind as NonNullable<RowPatch<"trip_documents">["kind"]>;
  }
  if (Object.keys(patch).length === 0) throw new DomainError("nothing to update");
  return patch;
}

// An idea is stored whole (data = the idea without id and version): its many
// optional fields belong to the ideas feature, not to the database.
export function ideaData(value: unknown): Json {
  if (!isObject(value)) throw new DomainError("idea must be an object");
  const { id: _id, version: _version, ...data } = value;
  if (typeof data.url !== "string" || !data.url) throw new DomainError("idea url is required");
  if (jsonBytes(data) > IDEA_BYTES) throw new DomainError("idea is too large");
  return data as Json;
}

export function newIdeaRow(args: unknown, position: number): NewRow<"trip_ideas"> {
  if (!isObject(args)) throw new DomainError("arguments must be an object");
  return { id: args.id === undefined ? uid() : checkClientId(args.id), position, data: ideaData(args.idea) };
}

// Map places by activity id; null removes the place.
export function placesArg(args: unknown): Map<string, Json | null> {
  if (!isObject(args) || !isObject(args.places)) throw new DomainError("places must be an object keyed by activity id");
  const entries = Object.entries(args.places);
  if (entries.length === 0) throw new DomainError("nothing to update");
  if (entries.length > MAX_PLACES_PER_OP) throw new DomainError(`at most ${MAX_PLACES_PER_OP} places at a time`);
  const out = new Map<string, Json | null>();
  for (const [id, place] of entries) {
    checkClientId(id, "activity id");
    if (place === null) {
      out.set(id, null);
      continue;
    }
    if (!isObject(place) || typeof place.key !== "string" || !["place", "ship", "none"].includes(place.kind as string)) {
      throw new DomainError(`place for ${id} must have a key and a kind (place, ship or none)`);
    }
    const { version: _version, ...data } = place;
    if (jsonBytes(data) > PLACE_BYTES) throw new DomainError(`place for ${id} is too large`);
    out.set(id, data as Json);
  }
  return out;
}

export interface IdeaSettingsPatch {
  idea_places?: Json | null;
  idea_plan?: Json | null;
}

// The idea place list (null = derived from the trip) and the last "Analizar
// con Claude" result, kept under its payload keys.
export function ideaSettingsPatch(args: unknown): IdeaSettingsPatch {
  if (!isObject(args)) throw new DomainError("arguments must be an object");
  const patch: IdeaSettingsPatch = {};
  if (args.ideaPlaces !== undefined) {
    const places = args.ideaPlaces;
    if (places !== null && (!Array.isArray(places) || !places.every((p) => typeof p === "string" && p.length <= LIMITS.label))) {
      throw new DomainError("ideaPlaces must be a list of place names");
    }
    patch.idea_places = places as Json | null;
  }
  if (args.ideaPlan !== undefined) {
    const plan = args.ideaPlan;
    if (plan !== null) {
      if (!isObject(plan) || Object.keys(plan).some((k) => !["ideaLinks", "ideaLinksAt", "ideaLinksIds"].includes(k))) {
        throw new DomainError("ideaPlan may only hold ideaLinks, ideaLinksAt and ideaLinksIds");
      }
      if (jsonBytes(plan) > IDEA_PLAN_BYTES) throw new DomainError("ideaPlan is too large");
    }
    patch.idea_plan = plan as Json | null;
  }
  if (Object.keys(patch).length === 0) throw new DomainError("nothing to update");
  return patch;
}
