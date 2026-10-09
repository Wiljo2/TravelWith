import { LIMITS } from "@/constants/limits";
import { DomainError, argId } from "@/server/domain/core";
import { daySpanPatch, newDaySpanRow, newTripSpanRow, tripSpanPatch } from "@/server/domain/spanRows";
import { daySpansRepo } from "@/server/repo/daySpans";
import { RowNotFoundError } from "@/server/repo/errors";
import { tripSpansRepo } from "@/server/repo/tripSpans";
import { requireDayRow, requireEventRows } from "@/server/ops/shared";
import type { OpDefinition } from "@/server/ops/types";

function nextPosition(rows: { position: number }[]): number {
  return rows.length ? Math.max(...rows.map((r) => r.position)) + 1 : 0;
}

export const SPAN_OPS: Record<string, OpDefinition> = {
  "daySpan.create": {
    async run(ctx, { args }) {
      const dayId = (args as { dayId?: unknown }).dayId;
      if (typeof dayId !== "string") throw new DomainError("dayId is required");
      await requireDayRow(ctx.code, dayId);
      const existing = await daySpansRepo.list(ctx.code, { column: "day_id", value: dayId });
      if (existing.length >= LIMITS.spansPerDay) throw new DomainError(`Day ${dayId} already has ${LIMITS.spansPerDay} spans`);
      const newRow = newDaySpanRow(args, nextPosition(existing));
      await requireEventRows(ctx.code, [newRow.start_event_id, newRow.end_event_id]);
      const row = await daySpansRepo.insert(ctx.code, newRow, ctx.userId);
      return { changed: [{ table: "trip_day_spans", row }], deleted: [] };
    },
  },

  "daySpan.update": {
    async run(ctx, { args, expectedVersion }) {
      const id = argId(args);
      const current = await daySpansRepo.get(ctx.code, id);
      if (!current) throw new RowNotFoundError("trip_day_spans", id);
      const patch = daySpanPatch(current, args);
      await requireEventRows(ctx.code, [patch.start_event_id, patch.end_event_id]);
      const row = await daySpansRepo.update(ctx.code, id, patch, expectedVersion, ctx.userId);
      return { changed: [{ table: "trip_day_spans", row }], deleted: [] };
    },
  },

  "daySpan.delete": {
    async run(ctx, { args, expectedVersion }) {
      const id = argId(args);
      await daySpansRepo.remove(ctx.code, id, expectedVersion, ctx.userId);
      return { changed: [], deleted: [{ table: "trip_day_spans", id }] };
    },
  },

  "tripSpan.create": {
    async run(ctx, { args }) {
      const existing = await tripSpansRepo.list(ctx.code);
      if (existing.length >= LIMITS.tripSpans) throw new DomainError(`The trip already has ${LIMITS.tripSpans} spans`);
      const newRow = newTripSpanRow(args, nextPosition(existing));
      await requireEventRows(ctx.code, [newRow.start_event_id, newRow.end_event_id]);
      const row = await tripSpansRepo.insert(ctx.code, newRow, ctx.userId);
      return { changed: [{ table: "trip_spans", row }], deleted: [] };
    },
  },

  "tripSpan.update": {
    async run(ctx, { args, expectedVersion }) {
      const id = argId(args);
      const patch = tripSpanPatch(args);
      await requireEventRows(ctx.code, [patch.start_event_id, patch.end_event_id]);
      const row = await tripSpansRepo.update(ctx.code, id, patch, expectedVersion, ctx.userId);
      return { changed: [{ table: "trip_spans", row }], deleted: [] };
    },
  },

  "tripSpan.delete": {
    async run(ctx, { args, expectedVersion }) {
      const id = argId(args);
      await tripSpansRepo.remove(ctx.code, id, expectedVersion, ctx.userId);
      return { changed: [], deleted: [{ table: "trip_spans", id }] };
    },
  },
};
