import { useCallback, useEffect, useRef } from "react";
import { apiFetch } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { videoRetryDue } from "@/utils/ideaVideo";
import type { Idea } from "@/types";

const UPLOAD_MAX_BYTES = 100 * 1024 * 1024;

// Asks the server to analyze an idea's video again: by hand ("Reintentar"), on
// its own when a failed analysis is due, or with a file the member uploads
// (straight to Storage through a signed URL). Results arrive over Broadcast.
export function useIdeaVideo(roomCode: string, accessToken: string | undefined, ideas: Idea[], enabled: boolean) {
  const asked = useRef(new Set<string>());

  const analyze = useCallback(async (id: string, body: { auto?: boolean; uploadPath?: string }) => {
    const res = await apiFetch(`/api/rooms/${roomCode}/ideas/${encodeURIComponent(id)}/video`, accessToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    return !!res?.ok;
  }, [roomCode, accessToken]);

  const retry = useCallback((id: string) => analyze(id, {}), [analyze]);

  // Resolves with an error message, or null when the analysis started.
  const upload = useCallback(async (id: string, file: File): Promise<string | null> => {
    if (!supabase) return "No disponible sin conexión al servidor";
    if (!file.type.startsWith("video/")) return "Elige un archivo de video";
    if (file.size > UPLOAD_MAX_BYTES) return "El video pesa más de 100 MB";
    const res = await apiFetch(`/api/rooms/${roomCode}/ideas/${encodeURIComponent(id)}/upload-url`, accessToken, { method: "POST" }).catch(() => null);
    const target = res?.ok ? ((await res.json()) as { path: string; token: string }) : null;
    if (!target) return "No se pudo preparar la subida";
    const { error } = await supabase.storage.from("idea-videos").uploadToSignedUrl(target.path, target.token, file, { contentType: file.type });
    if (error) return "No se pudo subir el video";
    return (await analyze(id, { uploadPath: target.path })) ? null : "No se pudo analizar el video";
  }, [roomCode, accessToken, analyze]);

  useEffect(() => {
    if (!enabled) return;
    for (const idea of ideas) {
      const key = `${idea.id}|${idea.video?.retryAt}`;
      if (asked.current.has(key) || !videoRetryDue(idea)) continue;
      asked.current.add(key);
      void analyze(idea.id, { auto: true });
    }
  }, [enabled, ideas, analyze]);

  return { retry, upload };
}
