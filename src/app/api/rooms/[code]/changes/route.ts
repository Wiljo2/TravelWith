import { NextResponse } from "next/server";
import { requireMember } from "@/server/auth";
import { HttpError, errorResponse, roomCodeParam } from "@/server/http";
import { listActivity } from "@/server/activity";

type Params = Promise<{ code: string }>;

// GET /api/rooms/[code]/changes?before=<id> — trip history, newest first (members only)
export async function GET(req: Request, { params }: { params: Params }) {
  try {
    const code = roomCodeParam((await params).code);
    await requireMember(req, code);
    const raw = new URL(req.url).searchParams.get("before");
    const before = raw === null ? undefined : Number(raw);
    if (before !== undefined && !(Number.isInteger(before) && before > 0)) throw new HttpError(400, "Parámetro inválido");
    return NextResponse.json(await listActivity(code, before));
  } catch (e) {
    return errorResponse(e, "GET /api/rooms/[code]/changes");
  }
}
