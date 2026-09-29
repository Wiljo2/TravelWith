import { useState } from "react";
import type { Extra } from "@/types";
import { DEFAULT_RATE } from "@/utils/currency";

export function useBudget() {
  const [extras, setExtras] = useState<Extra[]>([]);
  const [exchangeRate, setExchangeRate] = useState<number>(DEFAULT_RATE);

  function updateExtra(id: string, patch: Partial<Extra>) {
    setExtras((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
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
    return newExtra.id;
  }

  function removeExtra(id: string) {
    setExtras((prev) => prev.filter((x) => x.id !== id));
  }

  function loadBudget(incoming: Extra[], rate: number) {
    setExtras(incoming);
    setExchangeRate(rate);
  }

  return {
    extras, exchangeRate,
    setExchangeRate,
    updateExtra,
    addExtra, removeExtra,
    loadBudget,
  };
}
