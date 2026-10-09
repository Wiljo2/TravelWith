import { createServerClient } from "@/lib/supabase-server";
import { HttpError } from "@/server/http";
import { repoError } from "@/server/repo/errors";
import { DEFAULT_RATE } from "@/utils/currency";
import type { RoomMember, RoomPayload } from "@/types";
import type { Json } from "@/types/database";

export interface TripSnapshot {
  code: string;
  payload: RoomPayload;
  members: RoomMember[];
  updated_at: string;
}

// The trip header as stored on rooms (and as broadcast on the trip channel).
export interface RoomHeaderRow {
  code: string;
  name: string | null;
  destination: string | null;
  start_date: string | null;
  end_date: string | null;
  exchange_rate: number | null;
  idea_places: Json | null;
  idea_plan: Json | null;
}

const HEADER_COLUMNS = "code, name, destination, start_date, end_date, exchange_rate, idea_places, idea_plan";

export async function getTripHeader(code: string): Promise<RoomHeaderRow | null> {
  const { data, error } = await createServerClient().from("rooms").select(HEADER_COLUMNS).eq("code", code).maybeSingle();
  if (error) throw repoError(error);
  return (data ?? null) as RoomHeaderRow | null;
}

// Header fields are last-write-wins: rooms has no row version, and each field
// is set on its own (rate, name, dates) rather than merged.
export async function updateTripHeader(
  code: string,
  patch: Partial<Omit<RoomHeaderRow, "code">>,
): Promise<RoomHeaderRow> {
  const { data, error } = await createServerClient()
    .from("rooms")
    .update(patch)
    .eq("code", code)
    .select(HEADER_COLUMNS)
    .maybeSingle();
  if (error) throw repoError(error);
  if (!data) throw new HttpError(404, "Sala no encontrada");
  return data as RoomHeaderRow;
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
