import { HttpError } from "@/server/http";
import { EVENT_OPS } from "@/server/ops/events";
import type { OpContext, OpDefinition, OpInput, OpResult } from "@/server/ops/types";

// Every trip write goes through here: the ops route today, the agent tools next.
export const OPS: Record<string, OpDefinition> = {
  ...EVENT_OPS,
};

export function isKnownOp(name: string): boolean {
  return Object.hasOwn(OPS, name);
}

export async function runOp(name: string, ctx: OpContext, input: OpInput): Promise<OpResult> {
  if (!isKnownOp(name)) throw new HttpError(400, "Operación desconocida");
  const op = OPS[name];
  if (op.minRole === "owner" && ctx.role !== "owner") {
    throw new HttpError(403, "Solo el creador del viaje puede hacer esto");
  }
  return op.run(ctx, input);
}
