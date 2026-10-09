import { createServerClient } from "@/lib/supabase-server";
import { tableRepo } from "@/server/repo/core";
import { repoError } from "@/server/repo/errors";
import type { Json, TripEventPlaceRow } from "@/types/database";

// Map places, one row per activity (id = event id). The map locates many
// activities at once and a place is derived data, so writes are upserts
// without a version guard; the database still bumps the version.
const placesRepo = tableRepo("trip_event_places");

export async function upsertEventPlaces(code: string, places: Map<string, Json>, userId: string): Promise<TripEventPlaceRow[]> {
  if (places.size === 0) return [];
  const { data, error } = await createServerClient()
    .from("trip_event_places")
    .upsert(
      [...places].map(([id, data]) => ({ room_code: code, id, data, updated_by: userId })),
      { onConflict: "room_code,id" },
    )
    .select("*");
  if (error) throw repoError(error);
  return (data ?? []) as TripEventPlaceRow[];
}

export async function removeEventPlace(code: string, id: string, userId: string): Promise<boolean> {
  return (await placesRepo.remove(code, id, undefined, userId)) !== null;
}
