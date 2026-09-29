import type Anthropic from "@anthropic-ai/sdk";
import { createServerClient } from "@/lib/supabase-server";

const DEFAULT_DAILY_TOKEN_LIMIT = 300_000;

// Per-user tokens (input incl. cache reads/writes + output) per UTC day.
// AGENT_DAILY_TOKEN_LIMIT=0 disables the assistant entirely.
export function dailyTokenLimit(): number {
  const raw = process.env.AGENT_DAILY_TOKEN_LIMIT?.trim();
  const value = raw ? Number(raw) : NaN;
  return Number.isFinite(value) && value >= 0 ? value : DEFAULT_DAILY_TOKEN_LIMIT;
}

export interface Usage {
  input: number;
  output: number;
}

export function addUsage(total: Usage, usage: Anthropic.Usage): void {
  total.input += usage.input_tokens + (usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0);
  total.output += usage.output_tokens;
}

export async function tokensUsedToday(userId: string): Promise<number> {
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  const { data, error } = await createServerClient()
    .from("agent_usage")
    .select("input_tokens, output_tokens")
    .eq("user_id", userId)
    .gte("created_at", since.toISOString());
  if (error) throw error;
  return (data ?? []).reduce((n, r) => n + r.input_tokens + r.output_tokens, 0);
}

export async function recordUsage(userId: string, roomCode: string, usage: Usage): Promise<void> {
  if (usage.input === 0 && usage.output === 0) return;
  const { error } = await createServerClient()
    .from("agent_usage")
    .insert({ user_id: userId, room_code: roomCode, input_tokens: usage.input, output_tokens: usage.output });
  if (error) console.error("[agent] failed to record usage", error);
}
