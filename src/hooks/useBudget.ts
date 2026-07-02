import { useState } from "react";
import type { Extra } from "@/types";
import { DEFAULT_RATE } from "@/utils/currency";

const DEFAULT_EXTRAS: Extra[] = [
  // Globales — costo fijo del viaje
  { id: "cruise", label: "Crucero (2 pax)",          amount: 858,  currency: "USD" },
  { id: "x2",    label: "Vuelos ida/vuelta (2 pax)", amount: 700,  currency: "USD" },
  // Por día — distribuidos en un rango de días
  { id: "x1",    label: "Hotel Miami (2 noches)",    amount: 631000, currency: "COP", startDayId: "d0", endDayId: "d1" },
  { id: "x3",    label: "Excursiones / cabañas",     amount: 250,  currency: "USD",  startDayId: "d4", endDayId: "d5" },
  { id: "x4",    label: "Comidas + Uber + extras",   amount: 500,  currency: "USD",  startDayId: "d0", endDayId: "d6" },
];

export function useBudget() {
  const [extras, setExtras] = useState<Extra[]>(DEFAULT_EXTRAS);
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
