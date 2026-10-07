import type { Extra, TaskOption } from "@/types";

export const DEFAULT_RATE = 4000;

export function usdToCop(usd: number, rate: number): number {
  return Math.round((Number(usd) || 0) * rate);
}

export function extraUnitUSD(amount: number, currency: "USD" | "COP" | undefined, rate: number): number {
  const a = Number(amount) || 0;
  return currency === "COP" ? a / rate : a;
}

export function extraGroupUSD(extra: Extra, people: number, rate: number): number {
  const unit = extraUnitUSD(extra.amount, extra.currency, rate);
  return extra.splitMode === "perPerson" ? unit * Math.max(1, people) : unit;
}

export function extraPerPersonUSD(extra: Extra, people: number, rate: number): number {
  const unit = extraUnitUSD(extra.amount, extra.currency, rate);
  return extra.splitMode === "perPerson" ? unit : unit / Math.max(1, people);
}

// Group-total USD of a single task option (mirrors extraGroupUSD's split logic).
export function optionGroupUSD(o: TaskOption, people: number, rate: number): number {
  const unit = extraUnitUSD(o.amount ?? 0, o.currency, rate);
  return o.splitMode === "perPerson" ? unit * Math.max(1, people) : unit;
}

export function copToUsd(cop: number, rate: number): number {
  if (!rate) return 0;
  return (Number(cop) || 0) / rate;
}

// all amounts use es-CO (dots as thousand separator: 1.290, 4.760.000)
export function fmtUSD(usd: number): string {
  return `US$${Math.round(usd).toLocaleString("es-CO")}`;
}

export function fmtCOP(cop: number): string {
  return `$${Math.round(cop).toLocaleString("es-CO")} COP`;
}

// Bare number (no currency symbol), for cells that render their own "$" or "COP".
export function fmtNum(n: number): string {
  return Math.round(n).toLocaleString("es-CO");
}

export function fmtUSDNum(usd: number): string {
  return `$${Math.round(usd).toLocaleString("es-CO")}`;
}

export function fmtCOPNum(cop: number): string {
  return `$${Math.round(cop).toLocaleString("es-CO")}`;
}
