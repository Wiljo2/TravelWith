import { NextResponse } from "next/server";
import { createServerClient, getUserFromToken } from "@/lib/supabase-server";
import { normalizeRoomCode, validateRoomPayload } from "@/lib/validate";

type Params = Promise<{ code: string }>;

export async function GET(_req: Request, { params }: { params: Params }) {
  const code = normalizeRoomCode((await params).code);
  if (!code) return NextResponse.json({ error: "Código inválido" }, { status: 400 });
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("rooms")
    .select("code, payload, members, updated_at")
    .eq("code", code)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Sala no encontrada" }, { status: 404 });
  }

  return NextResponse.json(data);
}

// DELETE /api/rooms/[code] — hard-delete the trip for EVERYONE. Owner only.
// The normal flow is leaving via DELETE /members (last one out deletes the room).
export async function DELETE(req: Request, { params }: { params: Params }) {
  const code = normalizeRoomCode((await params).code);
  if (!code) return NextResponse.json({ error: "Código inválido" }, { status: 400 });

  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const user = await getUserFromToken(token);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const supabase = createServerClient();

  const { data: membership } = await supabase
    .from("user_rooms")
    .select("role")
    .eq("room_code", code)
    .eq("user_id", user.id)
    .maybeSingle();

  if (membership?.role !== "owner") {
    return NextResponse.json({ error: "Solo el creador puede eliminar el viaje para todos" }, { status: 403 });
  }

  await supabase.from("user_rooms").delete().eq("room_code", code);

  const { error } = await supabase
    .from("rooms")
    .delete()
    .eq("code", code);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// PATCH /api/rooms/[code] — save the full payload.
// Optional optimistic concurrency: when the client sends `expectedUpdatedAt`
// and it doesn't match the stored row, respond 409 with the current server
// state instead of overwriting a newer save from another member.
export async function PATCH(req: Request, { params }: { params: Params }) {
  const code = normalizeRoomCode((await params).code);
  if (!code) return NextResponse.json({ error: "Código inválido" }, { status: 400 });
  const supabase = createServerClient();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  const { expectedUpdatedAt, ...rest } = (body ?? {}) as Record<string, unknown>;
  const payload = validateRoomPayload(rest);
  if (!payload) {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  if (typeof expectedUpdatedAt === "string") {
    const { data: current, error: fetchError } = await supabase
      .from("rooms")
      .select("payload, updated_at")
      .eq("code", code)
      .maybeSingle();

    if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
    if (!current) return NextResponse.json({ error: "Sala no encontrada" }, { status: 404 });

    if (current.updated_at !== expectedUpdatedAt) {
      return NextResponse.json(
        { error: "Conflicto de versión", payload: current.payload, updated_at: current.updated_at },
        { status: 409 },
      );
    }
  }

  const update: { payload: typeof payload; name?: string } = { payload };
  if (payload.trip?.name) update.name = payload.trip.name;

  const { data, error } = await supabase
    .from("rooms")
    .update(update)
    .eq("code", code)
    .select("updated_at")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Sala no encontrada" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, updated_at: data.updated_at });
}
