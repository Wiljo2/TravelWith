import type { RoomPayload } from "@/types";
import { validateRoomPayload } from "@/lib/validate";
import type { LocalVariant } from "@/data/localMode";
import { freshRoomPayload } from "@/data/freshRoom";
import { sandboxTrip } from "@/data/localSandbox";

// Local mode prefers a snapshot of a real room (`npm run snapshot -- <CODE>`, gitignored)
// and falls back to the fictional demo trip. The "new" variant is the trip created in the sandbox.
export async function loadLocalPayload(variant: LocalVariant): Promise<RoomPayload> {
  if (variant === "new") return freshRoomPayload(sandboxTrip());
  try {
    const res = await fetch("/local-snapshot.json", { cache: "no-store" });
    if (res.ok) {
      const snapshot = validateRoomPayload(await res.json());
      if (snapshot) return snapshot;
    }
  } catch {}
  return (await import("@/data/mockRoom")).mockRoomPayload;
}
