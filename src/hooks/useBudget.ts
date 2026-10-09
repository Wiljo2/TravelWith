import { useCallback, useState } from "react";
import type { Extra } from "@/types";
import { DEFAULT_RATE } from "@/utils/currency";
import { sendable } from "@/lib/opQueue";
import { applyToList, rowToExtra, type Row } from "@/utils/tripRows";
import type { SendOp } from "@/hooks/useTripOps";
import type { Notify } from "@/hooks/useSnackbar";

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

export function useBudget(send: SendOp, notify?: Notify) {
  const [extras, setExtras] = useState<Extra[]>([]);
  const [exchangeRate, setRate] = useState<number>(DEFAULT_RATE);

  function updateExtra(id: string, patch: Partial<Extra>) {
    setExtras((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    const args = expenseArgs(id, patch);
    if (args) send("expense.update", args);
  }

  // An explicit commit of an expense row; updateExtra alone also serves silent changes like linking.
  function commitExtra(id: string, patch: Partial<Extra>) {
    setExtras((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    const args = expenseArgs(id, patch);
    if (!args) return;
    send("expense.update", args).then((outcome) => {
      if (outcome === "ok") notify?.({ message: "Gasto guardado" });
    });
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
    send("expense.create", Object.fromEntries(Object.entries(args).filter(([, v]) => v !== undefined))).then((outcome) => {
      if (outcome === "ok") notify?.({ message: "Gasto agregado" });
    });
    return newExtra.id;
  }

  function removeExtra(id: string) {
    setExtras((prev) => prev.filter((x) => x.id !== id));
    send("expense.delete", { id }).then((outcome) => {
      if (outcome === "ok") notify?.({ message: "Gasto eliminado" });
    });
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
    updateExtra, commitExtra,
    addExtra, removeExtra,
    loadBudget, applyRow, setRate,
  };
}
