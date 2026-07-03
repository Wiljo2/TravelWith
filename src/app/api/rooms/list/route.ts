import { NextResponse } from "next/server";
import { createServerClient, getUserFromToken } from "@/lib/supabase-server";
import type { TripInfo } from "@/types";

export interface TripListItem {
  code: string;
  name: string | null;
  role: string;
  joined_at: string;
  trip: TripInfo | null;
}

// GET /api/rooms/list — trips of the authenticated user, with trip metadata
export async function GET(req: Request) {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const user = await getUserFromToken(token);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const supabase = createServerClient();

  const { data: memberships, error: mErr } = await supabase
    .from("user_rooms")
    .select("room_code, role, joined_at")
    .eq("user_id", user.id)
    .order("joined_at", { ascending: false });

  if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 });
  if (!memberships || memberships.length === 0) return NextResponse.json([]);

  const codes = memberships.map((m) => m.room_code);
  const { data: rooms, error: rErr } = await supabase
    .from("rooms")
    .select("code, name, payload->trip")
    .in("code", codes);

  if (rErr) return NextResponse.json({ error: rErr.message }, { status: 500 });

  const byCode = new Map((rooms ?? []).map((r) => [r.code, r as { code: string; name: string | null; trip: TripInfo | null }]));

  const items: TripListItem[] = memberships.map((m) => {
    const room = byCode.get(m.room_code);
    return {
      code: m.room_code,
      name: room?.name ?? room?.trip?.name ?? null,
      role: m.role,
      joined_at: m.joined_at,
      trip: room?.trip ?? null,
    };
  });

  return NextResponse.json(items);
}
