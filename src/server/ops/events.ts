import { LIMITS } from "@/constants/limits";
import { DomainError, argId } from "@/server/domain/core";
import { eventMovePatch, eventUpdatePatch, newEventRow } from "@/server/domain/eventRows";
import { eventsRepo } from "@/server/repo/events";
import { RowNotFoundError } from "@/server/repo/errors";
import { requireDayRow, requireDocumentRow } from "@/server/ops/shared";
import type { OpContext, OpDefinition } from "@/server/ops/types";
import type { TripEventRow } from "@/types/database";

async function requireEventRow(code: string, id: string): Promise<TripEventRow> {
  const row = await eventsRepo.get(code, id);
  if (!row) throw new RowNotFoundError("trip_events", id);
  return row;
}

async function nextPositionInDay({ code }: OpContext, dayId: string): Promise<number> {
  const events = await eventsRepo.list(code, { column: "day_id", value: dayId });
  if (events.length >= LIMITS.eventsPerDay) {
    throw new DomainError(`Day ${dayId} already has ${LIMITS.eventsPerDay} events`);
  }
  return events.length ? Math.max(...events.map((e) => e.position)) + 1 : 0;
}

export const EVENT_OPS: Record<string, OpDefinition> = {
  "event.create": {
    async run(ctx, { args }) {
      const dayId = (args as { dayId?: unknown } | null)?.dayId;
      if (typeof dayId !== "string") throw new DomainError("dayId is required");
      await requireDayRow(ctx.code, dayId);
      const newRow = newEventRow(args, await nextPositionInDay(ctx, dayId));
      await requireDocumentRow(ctx.code, newRow.document_id);
      const row = await eventsRepo.insert(ctx.code, newRow, ctx.userId);
      return { changed: [{ table: "trip_events", row }], deleted: [] };
    },
  },

  "event.update": {
    async run(ctx, { args, expectedVersion }) {
      const id = argId(args);
      const current = await requireEventRow(ctx.code, id);
      const patch = eventUpdatePatch(current, args);
      await requireDocumentRow(ctx.code, patch.document_id);
      const row = await eventsRepo.update(ctx.code, id, patch, expectedVersion, ctx.userId);
      return { changed: [{ table: "trip_events", row }], deleted: [] };
    },
  },

  "event.move": {
    async run(ctx, { args, expectedVersion }) {
      const id = argId(args);
      const current = await requireEventRow(ctx.code, id);
      const dayId = (args as { dayId?: unknown }).dayId;
      if (typeof dayId !== "string") throw new DomainError("dayId is required");
      let position: number | undefined;
      if (dayId !== current.day_id) {
        await requireDayRow(ctx.code, dayId);
        position = await nextPositionInDay(ctx, dayId);
      }
      const patch = eventMovePatch(current, args, position);
      const row = await eventsRepo.update(ctx.code, id, patch, expectedVersion, ctx.userId);
      return { changed: [{ table: "trip_events", row }], deleted: [] };
    },
  },

  // Linked expenses are unlinked and trip spans using the event are removed by
  // the database (foreign keys); members receive those rows over Broadcast.
  "event.delete": {
    async run(ctx, { args, expectedVersion }) {
      const id = argId(args);
      await eventsRepo.remove(ctx.code, id, expectedVersion, ctx.userId);
      return { changed: [], deleted: [{ table: "trip_events", id }] };
    },
  },
};
