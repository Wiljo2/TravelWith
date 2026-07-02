import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

function genCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

const MAX_ATTEMPTS = 3;

export async function POST() {
  const supabase = createServerClient();

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const code = genCode();
    const { error } = await supabase
      .from("rooms")
      .insert({ code, payload: {} });

    if (!error) {
      return NextResponse.json({ code }, { status: 201 });
    }
    // 23505 = unique_violation → code collision, try a new one
    if (error.code !== "23505") {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "No se pudo generar un código único" }, { status: 500 });
}
