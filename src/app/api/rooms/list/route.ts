import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createServerClient } from "@/lib/supabase-server";
import { requireUser } from "@/server/auth";
import { errorResponse } from "@/server/http";
import type { TripInfo } from "@/types";

export interface TripListItem {
  code: string;
  name: string | null;
  role: string;
  joined_at: string;
  last_active_at: string;
  trip: TripInfo | null;
}

// GET /api/rooms/list — trips of the authenticated user, with trip metadata.
// Ordered by last_active_at desc so the first item is the trip to auto-resume.
export async function GET(req: Request) {
  try {
    return NextResponse.json(await listTrips(await requireUser(req)));
  } catch (e) {
    return errorResponse(e, "GET /api/rooms/list");
  }
}

async function listTrips(user: User): Promise<TripListItem[]> {
  const supabase = createServerClient();

  const { data: memberships, error: mErr } = await supabase
    .from("user_rooms")
    .select("room_code, role, joined_at, last_active_at")
    .eq("user_id", user.id)
    .order("last_active_at", { ascending: false });

  if (mErr) throw mErr;
  if (!memberships || memberships.length === 0) return [];

  const codes = memberships.map((m) => m.room_code);
  const { data: rooms, error: rErr } = await supabase
    .from("rooms")
    .select("code, name, payload->trip")
    .in("code", codes);

  if (rErr) throw rErr;

  const byCode = new Map((rooms ?? []).map((r) => [r.code, r as { code: string; name: string | null; trip: TripInfo | null }]));

  // Drop stale memberships whose room no longer exists (defensive — shouldn't
  // happen given the cleanup in DELETE /members, but never resume into a dead room).
  return memberships
    .filter((m) => byCode.has(m.room_code))
    .map((m) => {
      const room = byCode.get(m.room_code)!;
      return {
        code: m.room_code,
        name: room.name ?? room.trip?.name ?? null,
        role: m.role,
        joined_at: m.joined_at,
        last_active_at: m.last_active_at,
        trip: room.trip ?? null,
      };
    });
}
