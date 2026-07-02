import { NextResponse } from "next/server";
import { createServerClient } from "../../../../lib/supabase-server";
import type { RoomPayload } from "../../../../hooks/useRoom";

type Params = Promise<{ code: string }>;

// GET /api/rooms/[code] — verify the room exists and return its payload
export async function GET(_req: Request, { params }: { params: Params }) {
  const { code } = await params;
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("rooms")
    .select("code, payload, members, updated_at")
    .eq("code", code.toUpperCase())
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Sala no encontrada" }, { status: 404 });
  }

  return NextResponse.json(data);
}

// DELETE /api/rooms/[code] — remove the room and all user_rooms entries for it
export async function DELETE(_req: Request, { params }: { params: Params }) {
  const { code } = await params;
  const supabase = createServerClient();

  // Remove all members' references first
  await supabase.from("user_rooms").delete().eq("room_code", code.toUpperCase());

  const { error } = await supabase
    .from("rooms")
    .delete()
    .eq("code", code.toUpperCase());

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// PATCH /api/rooms/[code] — save the full itinerary + budget payload
export async function PATCH(req: Request, { params }: { params: Params }) {
  const { code } = await params;
  const supabase = createServerClient();

  let payload: RoomPayload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  if (!Array.isArray(payload?.days) || !Array.isArray(payload?.extras)) {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  const { error } = await supabase
    .from("rooms")
    .update({ payload })
    .eq("code", code.toUpperCase());

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
