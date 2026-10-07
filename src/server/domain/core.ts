import type { RoomPayload, Day } from "@/types";
import { LIMITS } from "@/constants/limits";

// Validation failure with a message the agent (or an API consumer) can act on.
export class DomainError extends Error {}

interface FieldSpec {
  type: "string" | "number" | "boolean";
  required?: boolean;
  max?: number;
}

// Tool inputs arrive as untyped JSON (schemas are not `strict`), so each
// domain entry point checks types first: a wrong type becomes a DomainError
// the model can correct instead of a TypeError that aborts the run.
export function checkArgs(args: unknown, spec: Record<string, FieldSpec>): void {
  if (typeof args !== "object" || args === null) throw new DomainError("arguments must be an object");
  const a = args as Record<string, unknown>;
  for (const [key, s] of Object.entries(spec)) {
    const v = a[key];
    if (v === undefined) {
      if (s.required) throw new DomainError(`${key} is required`);
      continue;
    }
    const ok = s.type === "number" ? typeof v === "number" && Number.isFinite(v) : typeof v === s.type;
    if (!ok) throw new DomainError(`${key} must be a ${s.type}`);
    if (s.max !== undefined && typeof v === "string" && v.length > s.max) {
      throw new DomainError(`${key} is too long (max ${s.max} characters)`);
    }
  }
}

export function requireDay(payload: RoomPayload, dayId: string): Day {
  const day = payload.days.find((d) => d.id === dayId);
  if (!day) {
    const ids = payload.days.map((d) => `${d.id} (${d.label})`).join(", ");
    throw new DomainError(`Day "${dayId}" not found. Valid days: ${ids}`);
  }
  return day;
}

const CLIENT_ID_RE = /^[A-Za-z0-9_-]+$/;

// Ids chosen by the client (so an optimistic insert keeps its id) share the
// format of utils/uid; anything else would end up in URLs, logs and channels.
export function checkClientId(id: unknown, field = "id"): string {
  if (typeof id !== "string" || !id || id.length > LIMITS.id || !CLIENT_ID_RE.test(id)) {
    throw new DomainError(`${field} must be 1-${LIMITS.id} letters, digits, "_" or "-"`);
  }
  return id;
}

// The id of the row an op targets, checked before the row is loaded.
export function argId(args: unknown): string {
  checkArgs(args, { id: { type: "string", required: true, max: LIMITS.id } });
  return (args as { id: string }).id;
}
