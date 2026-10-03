import { useEffect, useRef } from "react";
import { thumbExpired } from "@/utils/ideaMedia";
import type { Idea } from "@/types";

const SPACING_MS = 2000;      // TikTok answers 429 to bursts
const RENEW_BEFORE_MS = 6 * 3600_000;
const MAX_FAILURES = 3;       // in a row: TikTok is throttling, try again next session

const needsRenewal = (i: Idea) => i.platform === "tiktok" && i.status !== "discarded" && thumbExpired(i.thumbnail, RENEW_BEFORE_MS);

// Renews TikTok covers that expired (or are about to) in the background, one
// at a time, and stores the fresh URL in the idea: the whole group gets it.
// A single queue reads the latest ideas, so renewals never bunch up.
export function useFreshThumbnails(roomCode: string, ideas: Idea[], onFresh: (id: string, thumbnail: string) => void) {
  const tried = useRef(new Set<string>());
  const running = useRef(false);
  const latest = useRef({ roomCode, ideas, onFresh });
  latest.current = { roomCode, ideas, onFresh };
  const pending = ideas.filter((i) => needsRenewal(i) && !tried.current.has(i.id)).length;

  useEffect(() => {
    if (pending === 0 || running.current || !navigator.onLine) return;
    running.current = true;
    (async () => {
      let failures = 0;
      while (failures < MAX_FAILURES && latest.current.roomCode === roomCode) {
        const next = latest.current.ideas.find((i) => needsRenewal(i) && !tried.current.has(i.id));
        if (!next) break;
        tried.current.add(next.id);
        const data = await fetch(`/api/rooms/${roomCode}/thumb?format=json&url=${encodeURIComponent(next.url)}`)
          .then((r) => (r.ok ? r.json() : null)).catch(() => null) as { thumbnail?: string } | null;
        if (data?.thumbnail) {
          failures = 0;
          latest.current.onFresh(next.id, data.thumbnail);
        } else {
          failures++;
        }
        await new Promise((r) => setTimeout(r, SPACING_MS));
      }
      running.current = false;
    })();
  }, [roomCode, pending]);
}
