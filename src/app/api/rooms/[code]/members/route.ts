import { NextResponse } from "next/server";
import { createServerClient, getUserFromToken } from "../../../../../lib/supabase-server";
import type { RoomMember } from "../../../../../types";

type Params = Promise<{ code: string }>;

// GET /api/rooms/[code]/members — list members of a room
export async function GET(_req: Request, { params }: { params: Params }) {
  const { code } = await params;
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("rooms")
    .select("members")
    .eq("code", code.toUpperCase())
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Sala no encontrada" }, { status: 404 });

  return NextResponse.json(data.members ?? []);
}

// DELETE /api/rooms/[code]/members — remove the authenticated user from user_rooms
export async function DELETE(req: Request, { params }: { params: Params }) {
  const { code } = await params;

  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const user = await getUserFromToken(token);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const supabase = createServerClient();

  const { error } = await supabase
    .from("user_rooms")
    .delete()
    .eq("user_id", user.id)
    .eq("room_code", code.toUpperCase());

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

// POST /api/rooms/[code]/members — add the authenticated user to this room's member list
export async function POST(req: Request, { params }: { params: Params }) {
  const { code } = await params;

  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const user = await getUserFromToken(token);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const supabase = createServerClient();

  const { data: room, error: fetchError } = await supabase
    .from("rooms")
    .select("members")
    .eq("code", code.toUpperCase())
    .maybeSingle();

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  if (!room) return NextResponse.json({ error: "Sala no encontrada" }, { status: 404 });

  const members: RoomMember[] = room.members ?? [];

  // Idempotent — do nothing if already a member
  if (members.some((m) => m.userId === user.id)) {
    return NextResponse.json({ ok: true });
  }

  const newMember: RoomMember = {
    userId: user.id,
    name: String(user.user_metadata?.full_name ?? user.email ?? "Usuario"),
    avatar: user.user_metadata?.avatar_url as string | undefined,
    joinedAt: new Date().toISOString(),
  };

  const { error: updateError } = await supabase
    .from("rooms")
    .update({ members: [...members, newMember] })
    .eq("code", code.toUpperCase());

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
