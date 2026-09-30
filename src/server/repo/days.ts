import { createServerClient } from "@/lib/supabase-server";
import { tableRepo } from "@/server/repo/core";
import { repoError } from "@/server/repo/errors";
import type { TripDayRow, TripDaySpanRow, TripEventRow } from "@/types/database";

export const daysRepo = tableRepo("trip_days");

// SQL function swap_days: exchanges the events and day spans of two days.
export async function swapDays(code: string, a: string, b: string, userId: string) {
  const { data, error } = await createServerClient().rpc("swap_days", { p_code: code, p_a: a, p_b: b, p_user: userId });
  if (error) throw repoError(error);
  return data as { events: TripEventRow[]; daySpans: TripDaySpanRow[] };
}

export interface ResetDay {
  id: string;
  label: string;
  sub: string;
  flexible: boolean;
}

// SQL function reset_itinerary: clears the calendar and replaces the days.
export async function resetItinerary(code: string, days: ResetDay[], userId: string) {
  const { data, error } = await createServerClient().rpc("reset_itinerary", { p_code: code, p_days: days, p_user: userId });
  if (error) throw repoError(error);
  return data as { days: TripDayRow[] };
}
