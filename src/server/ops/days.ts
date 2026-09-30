import { argId } from "@/server/domain/core";
import { dayUpdatePatch, resetDays, swapArgs } from "@/server/domain/dayRows";
import { daysRepo, resetItinerary, swapDays } from "@/server/repo/days";
import { getTripDates } from "@/server/repo/trip";
import type { OpDefinition, RowChange } from "@/server/ops/types";

export const DAY_OPS: Record<string, OpDefinition> = {
  // Exchanges the events and day spans of two days (atomic, SQL function).
  "day.swap": {
    async run(ctx, { args }) {
      const { a, b } = swapArgs(args);
      const moved = await swapDays(ctx.code, a, b, ctx.userId);
      return {
        changed: [
          ...moved.events.map((row): RowChange => ({ table: "trip_events", row })),
          ...moved.daySpans.map((row): RowChange => ({ table: "trip_day_spans", row })),
        ],
        deleted: [],
      };
    },
  },

  "day.update": {
    async run(ctx, { args, expectedVersion }) {
      const id = argId(args);
      const row = await daysRepo.update(ctx.code, id, dayUpdatePatch(args), expectedVersion, ctx.userId);
      return { changed: [{ table: "trip_days", row }], deleted: [] };
    },
  },

  // Clears every event and span and regenerates the days from the trip dates.
  // Callers refetch the trip afterwards; the response lists the new days.
  "itinerary.reset": {
    minRole: "owner",
    async run(ctx) {
      const [dates, current] = await Promise.all([getTripDates(ctx.code), daysRepo.list(ctx.code)]);
      const result = await resetItinerary(ctx.code, resetDays(dates, current), ctx.userId);
      return { changed: result.days.map((row): RowChange => ({ table: "trip_days", row })), deleted: [] };
    },
  },
};
