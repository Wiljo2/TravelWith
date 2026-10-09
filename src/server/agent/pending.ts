import { createHmac, timingSafeEqual } from "node:crypto";
import { HttpError } from "@/server/http";
import type { ProposedAction } from "@/server/agent/actions";

export const MAX_TOKEN_BYTES = 400_000;
const TTL_MS = 15 * 60 * 1000;
const DEV_SECRET = "travelwith-dev-only-agent-resume-secret";

export interface PendingState {
  code: string;
  userId: string;
  exp: number;
  messages: unknown[];
  reads: { tool_use_id: string; content: string; is_error?: boolean }[];
  actions: ProposedAction[];
  toolUses: { id: string; name: string; input: Record<string, unknown> }[];
}

function secret(): string {
  const s = process.env.AGENT_RESUME_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === "production") throw new Error("AGENT_RESUME_SECRET is not configured");
  return DEV_SECRET;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

const invalid = () => new HttpError(400, "La propuesta no es válida. Pide el cambio de nuevo.");

export function signPending(state: Omit<PendingState, "exp">, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ ...state, exp: now + TTL_MS })).toString("base64url");
  const token = `${payload}.${sign(payload)}`;
  if (Buffer.byteLength(token) > MAX_TOKEN_BYTES) throw new Error("Pending state exceeds MAX_TOKEN_BYTES");
  return token;
}

export function verifyPending(
  token: unknown,
  expect: { code: string; userId: string },
  now = Date.now(),
): PendingState {
  if (typeof token !== "string" || token.length > MAX_TOKEN_BYTES) throw invalid();
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) throw invalid();
  const [payload, sig] = parts;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) throw invalid();

  let state: PendingState;
  try {
    state = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as PendingState;
  } catch {
    throw invalid();
  }
  if (!state || typeof state !== "object" || typeof state.exp !== "number") throw invalid();
  if (state.exp < now) throw new HttpError(400, "La propuesta expiró. Pide el cambio de nuevo.");
  if (state.code !== expect.code || state.userId !== expect.userId) throw invalid();
  return state;
}
