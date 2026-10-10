import { NextResponse, after } from "next/server";
import { requireMember } from "@/server/auth";
import { DomainError, checkClientId } from "@/server/domain/core";
import { HttpError, errorResponse, roomCodeParam } from "@/server/http";
import { assertWritable } from "@/server/maintenance";
import { analyzeIdeaVideo } from "@/server/video/analyze";
import { videoConfig } from "@/server/video/config";
import { uploadPrefix } from "@/server/video/sources";

type Params = Promise<{ code: string; id: string }>;

export const maxDuration = 300;

// POST /api/rooms/[code]/ideas/[id]/video — analyze an idea's video again.
// Body { auto?: boolean, uploadPath?: string }: auto = the app retrying a failed
// analysis whose time came (only then does it run); otherwise a member pressed
// "Reintentar" or uploaded the video (uploadPath, from the upload-url route).
// Runs after the response: the result reaches every member over Broadcast.
export async function POST(req: Request, { params }: { params: Params }) {
  try {
    const { code: rawCode, id: rawId } = await params;
    const code = roomCodeParam(rawCode);
    const id = parseId(rawId);
    assertWritable();
    const { user, role } = await requireMember(req, code);
    if (!videoConfig().enabled) throw new HttpError(503, "El análisis de video no está activado");
    const body = (await req.json().catch(() => ({}))) as { auto?: unknown; uploadPath?: unknown };
    const manual = body.auto !== true;
    let uploadPath: string | undefined;
    if (body.uploadPath !== undefined) {
      if (typeof body.uploadPath !== "string" || !body.uploadPath.startsWith(uploadPrefix(code, id)) || body.uploadPath.includes("..")) {
        throw new HttpError(400, "Archivo inválido");
      }
      uploadPath = body.uploadPath;
    }
    after(() =>
      analyzeIdeaVideo({ code, userId: user.id, role }, id, { manual, first: false, uploadPath })
        .catch((e) => console.error("[video] retry failed", id, e)),
    );
    return NextResponse.json({ ok: true }, { status: 202 });
  } catch (e) {
    return errorResponse(e, "POST /api/rooms/[code]/ideas/[id]/video");
  }
}

function parseId(raw: string): string {
  try {
    return checkClientId(raw);
  } catch (e) {
    if (e instanceof DomainError) throw new HttpError(400, "Idea inválida");
    throw e;
  }
}
