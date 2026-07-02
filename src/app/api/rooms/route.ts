import { NextResponse } from "next/server";
import { createServerClient } from "../../../lib/supabase-server";

function genCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

// POST /api/rooms — create a new room and return its code
export async function POST() {
  const supabase = createServerClient();
  const code = genCode();

  const { error } = await supabase
    .from("rooms")
    .insert({ code, payload: {} });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ code }, { status: 201 });
}
