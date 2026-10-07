import type { RoomPayload } from "@/types";
import { validateRoomPayload } from "@/lib/validate";

// Local mode prefers a snapshot of a real room (`npm run snapshot -- <CODE>`, gitignored)
// and falls back to the fictional demo trip.
export async function loadLocalPayload(): Promise<RoomPayload> {
  try {
    const res = await fetch("/local-snapshot.json", { cache: "no-store" });
    if (res.ok) {
      const snapshot = validateRoomPayload(await res.json());
      if (snapshot) return snapshot;
    }
  } catch {}
  return (await import("@/data/mockRoom")).mockRoomPayload;
}
