import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
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

export async function DELETE(_req: Request, { params }: { params: Params }) {
  const code = normalizeRoomCode((await params).code);
  if (!code) return NextResponse.json({ error: "Código inválido" }, { status: 400 });
  const supabase = createServerClient();

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

  const { data, error } = await supabase
    .from("rooms")
    .update({ payload })
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
