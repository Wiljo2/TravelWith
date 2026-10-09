import { LIMITS } from "@/constants/limits";
import { DomainError, argId } from "@/server/domain/core";
import { documentPatch, ideaData, ideaSettingsPatch, newDocumentRow, newIdeaRow, placesArg } from "@/server/domain/featureRows";
import { documentsRepo } from "@/server/repo/documents";
import { removeEventPlace, upsertEventPlaces } from "@/server/repo/eventPlaces";
import { eventsRepo } from "@/server/repo/events";
import { ideasRepo } from "@/server/repo/ideas";
import { updateTripHeader } from "@/server/repo/trip";
import type { OpDefinition, RowChange, RowDeletion } from "@/server/ops/types";
import type { Json } from "@/types/database";

const MAX_IDEAS = 500;

// Ops for the data main added (relational plan, step 3.14): Drive documents,
// ideas, trip map places and the idea settings.
export const FEATURE_OPS: Record<string, OpDefinition> = {
  "document.create": {
    async run(ctx, { args }) {
      const existing = await documentsRepo.list(ctx.code);
      if (existing.length >= LIMITS.documents) throw new DomainError(`The trip already has ${LIMITS.documents} documents`);
      const newRow = newDocumentRow(args, existing.length ? Math.max(...existing.map((d) => d.position)) + 1 : 0);
      if (existing.some((d) => d.drive_file_id === newRow.drive_file_id)) throw new DomainError("This Drive file is already linked to the trip");
      const row = await documentsRepo.insert(ctx.code, newRow, ctx.userId);
      return { changed: [{ table: "trip_documents", row }], deleted: [] };
    },
  },

  "document.update": {
    async run(ctx, { args, expectedVersion }) {
      const id = argId(args);
      const row = await documentsRepo.update(ctx.code, id, documentPatch(args), expectedVersion, ctx.userId);
      return { changed: [{ table: "trip_documents", row }], deleted: [] };
    },
  },

  // Activities and expenses that pointed at it are unlinked by the database;
  // members receive those rows over Broadcast.
  "document.delete": {
    async run(ctx, { args, expectedVersion }) {
      const id = argId(args);
      await documentsRepo.remove(ctx.code, id, expectedVersion, ctx.userId);
      return { changed: [], deleted: [{ table: "trip_documents", id }] };
    },
  },

  "idea.create": {
    async run(ctx, { args }) {
      const existing = await ideasRepo.list(ctx.code);
      if (existing.length >= MAX_IDEAS) throw new DomainError(`The trip already has ${MAX_IDEAS} ideas`);
      const position = existing.length ? Math.max(...existing.map((i) => i.position)) + 1 : 0;
      const row = await ideasRepo.insert(ctx.code, newIdeaRow(args, position), ctx.userId);
      return { changed: [{ table: "trip_ideas", row }], deleted: [] };
    },
  },

  // The whole idea is replaced; the version guard catches a concurrent edit.
  "idea.update": {
    async run(ctx, { args, expectedVersion }) {
      const id = argId(args);
      const data = ideaData((args as { idea?: unknown }).idea);
      const row = await ideasRepo.update(ctx.code, id, { data }, expectedVersion, ctx.userId);
      return { changed: [{ table: "trip_ideas", row }], deleted: [] };
    },
  },

  "idea.delete": {
    async run(ctx, { args, expectedVersion }) {
      const id = argId(args);
      await ideasRepo.remove(ctx.code, id, expectedVersion, ctx.userId);
      return { changed: [], deleted: [{ table: "trip_ideas", id }] };
    },
  },

  // Sets or clears the map place of several activities at once.
  "eventPlace.set": {
    async run(ctx, { args }) {
      const places = placesArg(args);
      const eventIds = new Set((await eventsRepo.list(ctx.code)).map((e) => e.id));
      const missing = [...places.keys()].filter((id) => places.get(id) !== null && !eventIds.has(id));
      if (missing.length) throw new DomainError(`Activity "${missing[0]}" not found`);

      const set = new Map([...places].filter((entry): entry is [string, Json] => entry[1] !== null));
      const rows = await upsertEventPlaces(ctx.code, set, ctx.userId);
      const deleted: RowDeletion[] = [];
      for (const [id, place] of places) {
        if (place === null && (await removeEventPlace(ctx.code, id, ctx.userId))) deleted.push({ table: "trip_event_places", id });
      }
      const changed: RowChange[] = rows.map((row) => ({ table: "trip_event_places", row }));
      return { changed, deleted };
    },
  },

  "trip.setIdeaSettings": {
    async run(ctx, { args }) {
      const trip = await updateTripHeader(ctx.code, ideaSettingsPatch(args));
      return { changed: [], deleted: [], trip };
    },
  },
};
