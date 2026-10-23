import type { User } from "@supabase/supabase-js";

export function firstName(user: Pick<User, "email" | "user_metadata">): string {
  const full = String(user.user_metadata?.full_name ?? "").trim();
  if (full) return full.split(/\s+/)[0];
  return (user.email ?? "").split("@")[0].trim();
}

// A roster name as the trip shows it next to others: its first word, without an email's domain.
export function shortName(name: string): string {
  return name.trim().split(/\s+/)[0].split("@")[0] || "Alguien";
}
