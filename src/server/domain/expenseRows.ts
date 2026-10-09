import { LIMITS } from "@/constants/limits";
import { DomainError, checkArgs, checkClientId } from "@/server/domain/core";
import { documentRefArg } from "@/server/domain/featureRows";
import type { NewRow, RowPatch } from "@/server/repo/core";
import type { TripExpenseRow } from "@/types/database";
import { uid } from "@/utils/uid";

// Pure validation for expense ops on rows. The op checks that referenced
// events and days exist and passes day positions for the range check.
// Updates clear references with null (or the legacy unlinkEvent /
// clearDayRange flags the agent uses).

const REF = { type: "string", max: LIMITS.id } as const;

type Args = Record<string, unknown>;

export function parseAmount(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new DomainError("amount must be a non-negative number");
  }
  return value;
}

export function parseCurrency(value: unknown): "USD" | "COP" {
  if (value !== "USD" && value !== "COP") throw new DomainError(`Invalid currency "${String(value)}". Valid: USD, COP`);
  return value;
}

export function parseSplitMode(value: unknown): "group" | "perPerson" {
  if (value !== "group" && value !== "perPerson") {
    throw new DomainError(
      `Invalid splitMode "${String(value)}". Valid: "group" (fixed total split across travelers) or "perPerson" (unit cost that scales with traveler count)`,
    );
  }
  return value;
}

function ref(a: Args, key: string): string | null | undefined {
  const v = a[key];
  if (v === undefined || v === null) return v;
  if (typeof v !== "string" || !v || v.length > LIMITS.id) throw new DomainError(`${key} must be an id`);
  return v;
}

// An expense spread over days must end on or after the day it starts.
export function checkDayRange(positions: Map<string, number>, startDayId: string | null, endDayId: string | null) {
  if (endDayId && !startDayId) throw new DomainError("endDayId requires startDayId");
  if (!startDayId || !endDayId) return;
  if ((positions.get(endDayId) ?? 0) < (positions.get(startDayId) ?? 0)) {
    throw new DomainError("endDayId must be the same day as startDayId or a later day");
  }
}

export function newExpenseRow(args: unknown, position: number): NewRow<"trip_expenses"> {
  checkArgs(args, {
    id: { type: "string" },
    label: { type: "string", required: true, max: LIMITS.label },
    amount: { type: "number", required: true },
  });
  const a = args as Args;
  const label = (a.label as string).trim();
  if (!label) throw new DomainError("label is required");
  return {
    id: a.id === undefined ? uid() : checkClientId(a.id),
    position,
    label,
    amount: parseAmount(a.amount),
    currency: a.currency === undefined ? "USD" : parseCurrency(a.currency),
    split_mode: a.splitMode === undefined ? "group" : parseSplitMode(a.splitMode),
    linked_event_id: ref(a, "linkedEventId") ?? null,
    start_day_id: ref(a, "startDayId") ?? null,
    end_day_id: ref(a, "endDayId") ?? null,
    document_id: documentRefArg(a.documentId) ?? null,
  };
}

export function expensePatch(args: unknown): RowPatch<"trip_expenses"> {
  checkArgs(args, {
    id: { type: "string", required: true },
    label: { type: "string", max: LIMITS.label },
    unlinkEvent: { type: "boolean" },
    clearDayRange: { type: "boolean" },
  });
  const a = args as Args;
  const patch: RowPatch<"trip_expenses"> = {};
  if (a.label !== undefined) {
    patch.label = (a.label as string).trim();
    if (!patch.label) throw new DomainError("label cannot be empty");
  }
  if (a.amount !== undefined) patch.amount = parseAmount(a.amount);
  if (a.currency !== undefined) patch.currency = parseCurrency(a.currency);
  if (a.splitMode !== undefined) patch.split_mode = parseSplitMode(a.splitMode);
  const linked = ref(a, "linkedEventId");
  if (linked !== undefined) patch.linked_event_id = linked;
  const start = ref(a, "startDayId");
  if (start !== undefined) patch.start_day_id = start;
  const end = ref(a, "endDayId");
  if (end !== undefined) patch.end_day_id = end;
  const documentId = documentRefArg(a.documentId);
  if (documentId !== undefined) patch.document_id = documentId;
  if (a.unlinkEvent) patch.linked_event_id = null;
  if (a.clearDayRange) {
    patch.start_day_id = null;
    patch.end_day_id = null;
  }
  if (Object.keys(patch).length === 0) throw new DomainError("nothing to update");
  return patch;
}

// The expense as it will be stored, to validate references on the result.
export function mergedExpense(current: TripExpenseRow, patch: RowPatch<"trip_expenses">): TripExpenseRow {
  return { ...current, ...patch } as TripExpenseRow;
}

export function exchangeRateArg(args: unknown): number {
  checkArgs(args, { rate: { type: "number", required: true } });
  const { rate } = args as { rate: number };
  if (rate <= 0) throw new DomainError("rate must be a positive number (COP per USD)");
  return rate;
}
