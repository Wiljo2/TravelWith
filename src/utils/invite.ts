import { normalizeRoomCode } from "@/lib/validate";

// `?code=` is taken by the Supabase PKCE OAuth redirect.
export const JOIN_PARAM = "join";
export const PENDING_JOIN_TTL_MS = 24 * 60 * 60 * 1000;

export function inviteLink(origin: string, code: string): string {
  return `${origin}/?${JOIN_PARAM}=${encodeURIComponent(code)}`;
}

export function inviteText(tripName?: string | null): string {
  const name = tripName?.trim();
  return `¡Te invito a planear ${name ? `«${name}»` : "nuestro viaje"} en TravelWith! Únete aquí:`;
}

export function inviteMessage(tripName: string | null | undefined, link: string): string {
  return `${inviteText(tripName)} ${link}`;
}

export function whatsappUrl(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

export function serializePendingJoin(code: string, now: number): string {
  return JSON.stringify({ code, at: now });
}

// Stored invitations expire so an old link never silently joins a trip days later.
export function parsePendingJoin(raw: string | null, now: number): string | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as { code?: unknown; at?: unknown };
    if (typeof value.code !== "string" || typeof value.at !== "number") return null;
    if (value.at > now || now - value.at > PENDING_JOIN_TTL_MS) return null;
    return normalizeRoomCode(value.code);
  } catch {
    return null;
  }
}
