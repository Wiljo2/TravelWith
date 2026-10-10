import { createServerClient } from "@/lib/supabase-server";
import type { GeminiUsage } from "@/server/video/gemini";
import type { VideoSource } from "@/server/video/sources";

// One row per analysis attempt in video_usage: the per-user daily quota and the
// real cost (tokens × price), to reconcile with the Google, Vercel and provider
// bills. Prices in USD per million tokens; thinking is billed as output. Update
// them from Google's pricing page when they change.
const PRICES: Record<string, { input: number; output: number }> = {
  "gemini-3.8-flash": { input: 0.75, output: 3.75 },
  "gemini-3.5-flash": { input: 0.75, output: 3.75 },
};

export function videoCostUSD(model: string, usage: GeminiUsage): number | null {
  const price = PRICES[model];
  if (!price) return null;
  return (usage.input * price.input + (usage.output + usage.thinking) * price.output) / 1_000_000;
}

// Analyses that reached Gemini and were billed; failed attempts don't count.
export async function videosAnalyzedToday(userId: string): Promise<number> {
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  const { count, error } = await createServerClient()
    .from("video_usage")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("ok", true)
    .gte("created_at", since.toISOString());
  if (error) throw error;
  return count ?? 0;
}

export interface VideoUsageEntry {
  userId: string;
  roomCode: string;
  ideaId: string;
  source: VideoSource;
  ok: boolean;
  reason?: string;
  model?: string;
  seconds?: number;
  bytes?: number;
  usage?: GeminiUsage;
  providerCalls?: number;
  attempts?: number;
  wallMs: number;
}

export async function recordVideoUsage(e: VideoUsageEntry): Promise<void> {
  const { error } = await createServerClient().from("video_usage").insert({
    user_id: e.userId,
    room_code: e.roomCode,
    idea_id: e.ideaId,
    source: e.source,
    ok: e.ok,
    reason: e.reason?.slice(0, 300) ?? null,
    model: e.model ?? null,
    video_seconds: e.seconds ?? null,
    bytes: e.bytes ?? null,
    input_tokens: e.usage?.input ?? 0,
    output_tokens: e.usage?.output ?? 0,
    thinking_tokens: e.usage?.thinking ?? 0,
    provider_calls: e.providerCalls ?? 0,
    attempts: e.attempts ?? 0,
    wall_ms: e.wallMs,
  });
  if (error) console.error("[video] failed to record usage", error);
}
