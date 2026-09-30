import { useCallback, useState } from "react";
import type { Extra } from "@/types";
import { DEFAULT_RATE } from "@/utils/currency";
import { sendable } from "@/lib/opQueue";
import { applyToList, rowToExtra, type Row } from "@/utils/tripRows";
import type { SendOp } from "@/hooks/useTripOps";

const CLEARABLE = ["linkedEventId", "startDayId", "endDayId"] as const;

// An `undefined` reference in a patch means "clear it": the server needs null.
function expenseArgs(id: string, patch: Partial<Extra>): Record<string, unknown> | null {
  const args: Record<string, unknown> = { id };
  for (const [k, v] of Object.entries(patch)) {
    if (k === "id" || k === "version") continue;
    if (v === undefined) {
      if ((CLEARABLE as readonly string[]).includes(k)) args[k] = null;
    } else {
      args[k] = v;
    }
  }
  return sendable(args);
}

export function useBudget(send: SendOp) {
  const [extras, setExtras] = useState<Extra[]>([]);
  const [exchangeRate, setRate] = useState<number>(DEFAULT_RATE);

  function updateExtra(id: string, patch: Partial<Extra>) {
    setExtras((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    const args = expenseArgs(id, patch);
    if (args) send("expense.update", args);
  }

  function addExtra(partial: Partial<Extra> = {}) {
    const newExtra: Extra = {
      id: crypto.randomUUID(),
      label: "Nuevo gasto",
      amount: 0,
      currency: "USD",
      ...partial,
    };
    setExtras((prev) => [...prev, newExtra]);
    const { version: _version, ...args } = newExtra;
    send("expense.create", Object.fromEntries(Object.entries(args).filter(([, v]) => v !== undefined)));
    return newExtra.id;
  }

  function removeExtra(id: string) {
    setExtras((prev) => prev.filter((x) => x.id !== id));
    send("expense.delete", { id });
  }

  function setExchangeRate(rate: number) {
    setRate(rate);
    if (Number.isFinite(rate) && rate > 0) send("trip.setExchangeRate", { rate });
  }

  const loadBudget = useCallback((incoming: Extra[], rate: number) => {
    setExtras(incoming);
    setRate(rate);
  }, []);

  const applyRow = useCallback((id: string, row: Row | null) => {
    setExtras((prev) => applyToList(prev, id, row, rowToExtra));
  }, []);

  return {
    extras, exchangeRate,
    setExchangeRate,
    updateExtra,
    addExtra, removeExtra,
    loadBudget, applyRow, setRate,
  };
}
