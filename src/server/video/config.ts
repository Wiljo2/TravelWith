// Video analysis settings, from the server environment. Without
// GEMINI_API_KEY the feature is off and ideas behave exactly as before.

const DEFAULT_MODEL = "gemini-3.8-flash";
const DEFAULT_FALLBACK_MODEL = "gemini-3.5-flash";
const DEFAULT_DAILY_LIMIT = 30;
const DEFAULT_MAX_SECONDS = 300;

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  const value = raw ? Number(raw) : NaN;
  return Number.isInteger(value) && value >= 0 ? value : fallback;
}

export function videoConfig() {
  const geminiKey = process.env.GEMINI_API_KEY?.trim() || undefined;
  const fallback = process.env.VIDEO_FALLBACK_MODEL?.trim();
  return {
    geminiKey,
    enabled: !!geminiKey,
    model: process.env.VIDEO_MODEL?.trim() || DEFAULT_MODEL,
    // "none" turns the fallback off.
    fallbackModel: fallback === "none" ? undefined : fallback || DEFAULT_FALLBACK_MODEL,
    dailyLimit: intEnv("VIDEO_DAILY_LIMIT", DEFAULT_DAILY_LIMIT),
    maxSeconds: intEnv("VIDEO_MAX_SECONDS", DEFAULT_MAX_SECONDS),
  };
}
