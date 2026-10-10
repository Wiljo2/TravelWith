import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { requireMember } from "@/server/auth";
import { DomainError, checkClientId } from "@/server/domain/core";
import { HttpError, errorResponse, roomCodeParam } from "@/server/http";
import { assertWritable } from "@/server/maintenance";
import { ideasRepo } from "@/server/repo/ideas";
import { videoConfig } from "@/server/video/config";
import { UPLOAD_BUCKET, uploadPrefix } from "@/server/video/sources";

type Params = Promise<{ code: string; id: string }>;

// POST /api/rooms/[code]/ideas/[id]/upload-url — a one-time signed URL to upload
// the idea's video straight to Storage (function bodies are capped at 4.5 MB).
// The member then calls .../video with { uploadPath }; the file is deleted
// after the analysis. Returns { path, token }.
export async function POST(req: Request, { params }: { params: Params }) {
  try {
    const { code: rawCode, id: rawId } = await params;
    const code = roomCodeParam(rawCode);
    let id: string;
    try {
      id = checkClientId(rawId);
    } catch (e) {
      if (e instanceof DomainError) throw new HttpError(400, "Idea inválida");
      throw e;
    }
    assertWritable();
    await requireMember(req, code);
    if (!videoConfig().enabled) throw new HttpError(503, "El análisis de video no está activado");
    if (!(await ideasRepo.get(code, id))) throw new HttpError(404, "Idea no encontrada");

    const path = `${uploadPrefix(code, id)}${crypto.randomUUID()}`;
    const { data, error } = await createServerClient().storage.from(UPLOAD_BUCKET).createSignedUploadUrl(path);
    if (error || !data) throw error ?? new Error("no upload url");
    return NextResponse.json({ path: data.path, token: data.token });
  } catch (e) {
    return errorResponse(e, "POST /api/rooms/[code]/ideas/[id]/upload-url");
  }
}
