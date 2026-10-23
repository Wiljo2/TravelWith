import type { User } from "@supabase/supabase-js";

export function firstName(user: Pick<User, "email" | "user_metadata">): string {
  const full = String(user.user_metadata?.full_name ?? "").trim();
  if (full) return full.split(/\s+/)[0];
  return (user.email ?? "").split("@")[0].trim();
}
