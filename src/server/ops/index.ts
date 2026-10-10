import { HttpError } from "@/server/http";
import { DAY_OPS } from "@/server/ops/days";
import { EVENT_OPS } from "@/server/ops/events";
import { EXPENSE_OPS } from "@/server/ops/expenses";
import { FEATURE_OPS } from "@/server/ops/features";
import { SPAN_OPS } from "@/server/ops/spans";
import { TASK_OPS } from "@/server/ops/tasks";
import { TRIP_OPS } from "@/server/ops/trip";
import type { OpContext, OpDefinition, OpInput, OpResult } from "@/server/ops/types";

// Every trip write goes through here: the ops route and the agent tools.
export const OPS: Record<string, OpDefinition> = {
  ...EVENT_OPS,
  ...DAY_OPS,
  ...SPAN_OPS,
  ...EXPENSE_OPS,
  ...TASK_OPS,
  ...TRIP_OPS,
  ...FEATURE_OPS,
};

export function isKnownOp(name: string): boolean {
  return Object.hasOwn(OPS, name);
}

export function isClientOp(name: string): boolean {
  return isKnownOp(name) && !OPS[name].internal;
}

export async function runOp(name: string, ctx: OpContext, input: OpInput): Promise<OpResult> {
  if (!isKnownOp(name)) throw new HttpError(400, "Operación desconocida");
  const op = OPS[name];
  if (op.minRole === "owner" && ctx.role !== "owner") {
    throw new HttpError(403, "Solo el creador del viaje puede hacer esto");
  }
  return op.run(ctx, input);
}
