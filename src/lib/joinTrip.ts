import { apiFetch } from "@/lib/api";
import { loadSnapshot } from "@/lib/offline";

// "offline": no network, but this device has a copy of the trip to open.
export type JoinOutcome = "joined" | "offline" | "notFound" | "failed";

// Reading a trip requires membership, so opening one by code registers first.
// The members endpoint is idempotent and answers 404 for unknown codes.
export async function joinTrip(code: string, accessToken: string | undefined): Promise<JoinOutcome> {
  const res = await apiFetch(`/api/rooms/${code}/members`, accessToken, { method: "POST" }).catch(() => null);
  if (!res) return loadSnapshot(code) ? "offline" : "failed";
  if (res.ok) return "joined";
  return res.status === 404 ? "notFound" : "failed";
}
