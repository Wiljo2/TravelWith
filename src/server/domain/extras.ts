import type { RoomPayload } from "@/hooks/useRoom";
import type { Extra } from "@/types";
import { DomainError, requireDay, findEvent } from "./core";

function validateCurrency(currency: string): asserts currency is "USD" | "COP" {
  if (currency !== "USD" && currency !== "COP") {
    throw new DomainError(`Invalid currency "${currency}". Valid: USD, COP`);
  }
}

function validateSplitMode(splitMode: string): asserts splitMode is "group" | "perPerson" {
  if (splitMode !== "group" && splitMode !== "perPerson") {
    throw new DomainError(
      `Invalid splitMode "${splitMode}". Valid: "group" (fixed total split across travelers) or "perPerson" (unit cost that scales with traveler count)`,
    );
  }
}

function validateAmount(amount: number) {
  if (!Number.isFinite(amount) || amount < 0) throw new DomainError("amount must be a non-negative number");
}

function requireExtra(payload: RoomPayload, extraId: string): Extra {
  const extra = payload.extras.find((x) => x.id === extraId);
  if (!extra) throw new DomainError(`Expense "${extraId}" not found. Use get_budget to list current expense ids.`);
  return extra;
}

function validateLinkedEvent(payload: RoomPayload, eventId: string) {
  if (!findEvent(payload, eventId)) {
    throw new DomainError(`linkedEventId "${eventId}" does not match any calendar event`);
  }
}

export interface AddExtraArgs {
  label: string;
  amount: number;
  currency?: string;
  splitMode?: string;
  linkedEventId?: string;
  startDayId?: string;
  endDayId?: string;
}

export function addExtra(payload: RoomPayload, args: AddExtraArgs): { payload: RoomPayload; extra: Extra } {
  if (!args.label.trim()) throw new DomainError("label is required");
  validateAmount(args.amount);
  const currency = args.currency ?? "USD";
  validateCurrency(currency);
  const splitMode = args.splitMode ?? "group";
  validateSplitMode(splitMode);
  if (args.linkedEventId) validateLinkedEvent(payload, args.linkedEventId);
  if (args.startDayId) requireDay(payload, args.startDayId);
  if (args.endDayId) requireDay(payload, args.endDayId);
  if (args.endDayId && !args.startDayId) throw new DomainError("endDayId requires startDayId");

  const extra: Extra = {
    id: crypto.randomUUID(),
    label: args.label.trim(),
    amount: args.amount,
    currency,
    splitMode,
    ...(args.linkedEventId ? { linkedEventId: args.linkedEventId } : {}),
    ...(args.startDayId ? { startDayId: args.startDayId } : {}),
    ...(args.endDayId ? { endDayId: args.endDayId } : {}),
  };

  return { payload: { ...payload, extras: [...payload.extras, extra] }, extra };
}

export interface UpdateExtraArgs {
  label?: string;
  amount?: number;
  currency?: string;
  splitMode?: string;
  linkedEventId?: string;
  unlinkEvent?: boolean;
  startDayId?: string;
  endDayId?: string;
  clearDayRange?: boolean;
}

export function updateExtra(
  payload: RoomPayload,
  extraId: string,
  patch: UpdateExtraArgs,
): { payload: RoomPayload; extra: Extra } {
  const current = requireExtra(payload, extraId);

  if (patch.amount !== undefined) validateAmount(patch.amount);
  if (patch.currency !== undefined) validateCurrency(patch.currency);
  if (patch.splitMode !== undefined) validateSplitMode(patch.splitMode);
  if (patch.linkedEventId) validateLinkedEvent(payload, patch.linkedEventId);
  if (patch.startDayId) requireDay(payload, patch.startDayId);
  if (patch.endDayId) requireDay(payload, patch.endDayId);

  const next: Extra = {
    ...current,
    ...(patch.label !== undefined ? { label: patch.label.trim() } : {}),
    ...(patch.amount !== undefined ? { amount: patch.amount } : {}),
    ...(patch.currency !== undefined ? { currency: patch.currency as "USD" | "COP" } : {}),
    ...(patch.splitMode !== undefined ? { splitMode: patch.splitMode as "group" | "perPerson" } : {}),
    ...(patch.linkedEventId !== undefined ? { linkedEventId: patch.linkedEventId } : {}),
    ...(patch.startDayId !== undefined ? { startDayId: patch.startDayId } : {}),
    ...(patch.endDayId !== undefined ? { endDayId: patch.endDayId } : {}),
  };
  if (patch.unlinkEvent) next.linkedEventId = undefined;
  if (patch.clearDayRange) {
    next.startDayId = undefined;
    next.endDayId = undefined;
  }
  if (!next.label) throw new DomainError("label cannot be empty");

  const extras = payload.extras.map((x) => (x.id === extraId ? next : x));
  return { payload: { ...payload, extras }, extra: next };
}

export function removeExtra(payload: RoomPayload, extraId: string): { payload: RoomPayload; extra: Extra } {
  const extra = requireExtra(payload, extraId);
  return { payload: { ...payload, extras: payload.extras.filter((x) => x.id !== extraId) }, extra };
}

export function setExchangeRate(payload: RoomPayload, rate: number): { payload: RoomPayload } {
  if (!Number.isFinite(rate) || rate <= 0) throw new DomainError("rate must be a positive number (COP per USD)");
  return { payload: { ...payload, exchangeRate: rate } };
}
