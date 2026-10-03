import type { User } from "@supabase/supabase-js";
import { createServerClient, getUserFromToken } from "@/lib/supabase-server";
import { HttpError } from "@/server/http";

export type MemberRole = "owner" | "member";

const BEARER_RE = /^Bearer\s+(\S+)$/i;

export function bearerToken(req: Request): string | null {
  return req.headers.get("Authorization")?.match(BEARER_RE)?.[1] ?? null;
}

export async function requireUser(req: Request): Promise<User> {
  const token = bearerToken(req);
  if (!token) throw new HttpError(401, "No autorizado");
  const user = await getUserFromToken(token);
  if (!user) throw new HttpError(401, "No autorizado");
  return user;
}

// Route handlers use the service role (RLS bypassed), so this is the access
// check for every room-scoped endpoint. Non-members get 403 whether or not the
// room exists, so the endpoint can't be used to probe for valid codes.
export async function requireMember(
  req: Request,
  code: string,
  minRole?: "owner",
): Promise<{ user: User; role: MemberRole }> {
  const user = await requireUser(req);
  const { data, error } = await createServerClient()
    .from("user_rooms")
    .select("role")
    .eq("room_code", code)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new HttpError(403, "No tienes acceso a este viaje");
  const role = data.role === "owner" ? "owner" : "member";
  if (minRole === "owner" && role !== "owner") {
    throw new HttpError(403, "Solo el creador del viaje puede hacer esto");
  }
  return { user, role };
}
