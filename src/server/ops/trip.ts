import { LIMITS } from "@/constants/limits";
import { DomainError, argId } from "@/server/domain/core";
import { newTravelerRow, tripHeaderPatch } from "@/server/domain/tripRows";
import { HttpError } from "@/server/http";
import { travelersRepo } from "@/server/repo/travelers";
import { getTripHeader, updateTripHeader } from "@/server/repo/trip";
import type { OpDefinition } from "@/server/ops/types";

export const TRIP_OPS: Record<string, OpDefinition> = {
  // Name, destination and dates (rooms.name stays the trip list's source).
  "trip.update": {
    async run(ctx, { args }) {
      const current = await getTripHeader(ctx.code);
      if (!current) throw new HttpError(404, "Sala no encontrada");
      const trip = await updateTripHeader(ctx.code, tripHeaderPatch(current, args));
      return { changed: [], deleted: [], trip };
    },
  },

  "traveler.add": {
    async run(ctx, { args }) {
      const existing = await travelersRepo.list(ctx.code);
      if (existing.length >= LIMITS.travelers) throw new DomainError(`The trip already has ${LIMITS.travelers} travelers`);
      const position = existing.length ? Math.max(...existing.map((t) => t.position)) + 1 : 0;
      const row = await travelersRepo.insert(ctx.code, newTravelerRow(args, position), ctx.userId);
      return { changed: [{ table: "trip_travelers", row }], deleted: [] };
    },
  },

  "traveler.remove": {
    async run(ctx, { args, expectedVersion }) {
      const id = argId(args);
      await travelersRepo.remove(ctx.code, id, expectedVersion, ctx.userId);
      return { changed: [], deleted: [{ table: "trip_travelers", id }] };
    },
  },
};
