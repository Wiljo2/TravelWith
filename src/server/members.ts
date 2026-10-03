import type { User } from "@supabase/supabase-js";
import { createServerClient } from "@/lib/supabase-server";
import type { MemberRole } from "@/server/auth";

const MAX_MEMBER_NAME = 80;
const AVATAR_HOSTS = new Set(["lh3.googleusercontent.com"]);

// Display profile copied into the rooms.members roster. user_metadata is
// user-editable, so the name is capped and only known avatar hosts are kept
// (anything else would let a member plant a tracking URL for everyone).
export function memberProfile(user: User): { name: string; avatar: string | null } {
  const rawName = user.user_metadata?.full_name ?? user.email ?? "Usuario";
  const name = String(rawName).trim().slice(0, MAX_MEMBER_NAME) || "Usuario";

  let avatar: string | null = null;
  const rawAvatar = user.user_metadata?.avatar_url;
  if (typeof rawAvatar === "string") {
    try {
      const url = new URL(rawAvatar);
      if (url.protocol === "https:" && AVATAR_HOSTS.has(url.host)) avatar = url.toString();
    } catch {
      // Not a URL: drop it.
    }
  }
  return { name, avatar };
}

export async function joinRoom(code: string, user: User, role: MemberRole): Promise<{ joined: boolean; role?: MemberRole }> {
  const { name, avatar } = memberProfile(user);
  const { data, error } = await createServerClient().rpc("join_room", {
    p_code: code,
    p_user: user.id,
    p_name: name,
    p_avatar: avatar,
    p_role: role,
  });
  if (error) throw error;
  return data as { joined: boolean; role?: MemberRole };
}

export async function leaveRoom(code: string, userId: string): Promise<{ left: boolean; roomDeleted?: boolean }> {
  const { data, error } = await createServerClient().rpc("leave_room", { p_code: code, p_user: userId });
  if (error) throw error;
  return data as { left: boolean; roomDeleted?: boolean };
}

export async function deleteRoom(code: string): Promise<void> {
  const { error } = await createServerClient().rpc("delete_room", { p_code: code });
  if (error) throw error;
}
