import { createServerClient } from "@/lib/supabase-server";
import { repoError } from "@/server/repo/errors";
import { DEFAULT_RATE } from "@/utils/currency";
import type { RoomMember, RoomPayload } from "@/types";

export interface TripSnapshot {
  code: string;
  payload: RoomPayload;
  members: RoomMember[];
  updated_at: string;
}

export async function getTripDates(code: string): Promise<{ startDate: string; endDate: string } | null> {
  const { data, error } = await createServerClient()
    .from("rooms")
    .select("start_date, end_date")
    .eq("code", code)
    .maybeSingle();
  if (error) throw repoError(error);
  const row = data as { start_date: string | null; end_date: string | null } | null;
  if (!row?.start_date || !row.end_date) return null;
  return { startDate: row.start_date, endDate: row.end_date };
}

// The whole trip assembled from the trip tables in one round trip (SQL
// function get_trip), or null when the room does not exist.
export async function getTrip(code: string): Promise<TripSnapshot | null> {
  const { data, error } = await createServerClient().rpc("get_trip", { p_code: code });
  if (error) throw repoError(error);
  if (!data) return null;
  const trip = data as TripSnapshot;
  return { ...trip, payload: { ...trip.payload, exchangeRate: trip.payload.exchangeRate ?? DEFAULT_RATE } };
}
