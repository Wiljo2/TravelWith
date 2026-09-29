"use client";
import { useState } from "react";
import type { Extra, Day } from "@/types";
import { CATEGORIES } from "@/constants/categories";
import { cn } from "@/lib/utils";

export type Currency = "USD" | "COP";
export type SplitMode = "group" | "perPerson";

export function toUSD(amount: number, currency: Currency, rate: number) {
  return currency === "COP" ? amount / rate : amount;
}
export function toCOP(amount: number, currency: Currency, rate: number) {
  return currency === "COP" ? amount : amount * rate;
}
export function parse(raw: string) {
  return parseFloat(raw.replace(/\./g, "").replace(",", ".")) || 0;
}

export const TH_CLASS = "px-3 py-2.5 text-[11px] font-semibold tracking-[.06em] text-muted-foreground border-b border-border";
export const CELL_CLASS = "px-3 py-2.5 border-b border-border align-middle max-md:border-none max-md:py-1.5";

// Below md the budget tables collapse into stacked cards: each row becomes a
// two-column grid and every cell prints its column name from data-label.
export const TABLE_CLASS = "w-full border-collapse max-md:block md:[&_td:first-child]:pl-5 md:[&_th:first-child]:pl-5 md:[&_td:last-child]:pr-4";
export const THEAD_CLASS = "max-md:hidden";
export const TBODY_CLASS = "max-md:block";
export const TFOOT_CLASS = "max-md:block [&_tr]:max-md:flex [&_tr]:max-md:items-end [&_tr]:max-md:justify-between [&_td]:max-md:block [&_td:only-child]:max-md:w-full";
export const ROW_CLASS = "max-md:relative max-md:grid max-md:grid-cols-2 max-md:border-b max-md:border-border max-md:px-1 max-md:py-2";
export const CELL_FULL_CLASS = "max-md:col-span-2";
export const CELL_LABEL_CLASS = "max-md:before:mb-1 max-md:before:block max-md:before:text-[10px] max-md:before:font-semibold max-md:before:tracking-[.06em] max-md:before:text-muted-foreground max-md:before:content-[attr(data-label)]";
export const CELL_ACTIONS_CLASS = "max-md:absolute max-md:right-1 max-md:top-2 max-md:w-auto";
export const ACTION_BTN_CLASS = "flex h-[26px] w-[26px] max-md:h-9 max-md:w-9 cursor-pointer items-center justify-center rounded-[5px]";
export const CALC_NUM_CLASS = "inline-block w-20 text-right font-mono text-[13px] italic text-muted-foreground";
export const SUB_LINE_CLASS = "mt-px text-right font-mono text-[10px] text-muted-foreground";

export function SectionHeader({ label, hint, className }: { label: string; hint?: string; className?: string }) {
  return (
    <div className={cn("mb-3", className)}>
      <h2 className="text-[15px] font-semibold">{label}</h2>
      {hint && <p className="mt-0.5 text-[13px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function InlineNumber({ value, onChange, width = 80 }: { value: number; onChange: (raw: string) => void; width?: number }) {
  const [raw, setRaw] = useState<string | null>(null);
  const fmt = Math.round(value) === 0 ? "0" : Math.round(value).toLocaleString("es-CO");
  return (
    <input type="text" inputMode="numeric"
      value={raw !== null ? raw : fmt}
      onFocus={() => setRaw(value === 0 ? "" : String(Math.round(value)))}
      onBlur={() => { if (raw !== null) onChange(raw); setRaw(null); }}
      onChange={(e) => { setRaw(e.target.value); onChange(e.target.value); }}
      className="border-none bg-transparent text-right font-mono text-[13px] text-foreground outline-none"
      style={{ width }}
    />
  );
}

export function CurrencyToggle({ currency, onClick }: { currency: Currency; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={cn(
        "shrink-0 cursor-pointer rounded-[5px] border border-border px-1.5 py-0.5 text-[10px] font-bold",
        currency === "COP" ? "bg-[#4ADE8022] text-[#16A34A]" : "bg-[#60A5FA22] text-[#2563EB]",
      )}>
      {currency}
    </button>
  );
}

// Grupal: fixed total split across people. Por persona: unit cost that scales with people.
export function ModeToggle({ mode, onChange }: { mode: SplitMode; onChange: (m: SplitMode) => void }) {
  const opts: { id: SplitMode; label: string; cls: string }[] = [
    { id: "group",     label: "Grupal",      cls: "bg-[#60A5FA22] text-[#2563EB]" },
    { id: "perPerson", label: "Por persona", cls: "bg-[#F59E0B22] text-[#B45309]" },
  ];
  return (
    <div className="mt-1.5 inline-flex overflow-hidden rounded-md border border-border">
      {opts.map((o) => (
        <button key={o.id} onClick={() => onChange(o.id)} type="button"
          title={o.id === "group" ? "Total fijo, se divide entre viajeros" : "Costo por viajero, escala con la cantidad"}
          className={cn(
            "cursor-pointer border-none px-2 py-0.5 text-[10px] font-semibold leading-relaxed",
            mode === o.id ? o.cls : "bg-transparent text-muted-foreground",
          )}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function EventLinkCell({ extra, days, onLink }: { extra: Extra; days: Day[]; onLink: (id: string | undefined) => void }) {
  const linked = extra.linkedEventId
    ? days.flatMap((d) => d.events.map((ev) => ({ day: d, ev }))).find((x) => x.ev.id === extra.linkedEventId)
    : undefined;
  const cat = linked ? CATEGORIES[linked.ev.cat as keyof typeof CATEGORIES] : undefined;

  if (linked) {
    return (
      <div className="flex items-center gap-1">
        <span
          className="flex max-w-[130px] items-center gap-1 truncate rounded-full border py-0.5 pl-[5px] pr-[7px] text-[11px]"
          style={{ background: cat?.bg, borderColor: cat?.border, color: cat?.text }}
        >
          <span className="h-[5px] w-[5px] shrink-0 rounded-full" style={{ background: cat?.dot ?? "#888" }} />
          {linked.ev.title}
        </span>
        <button onClick={() => onLink(undefined)} className="cursor-pointer text-[13px] leading-none text-muted-foreground hover:text-foreground">×</button>
      </div>
    );
  }
  return (
    <select value="" onChange={(e) => e.target.value && onLink(e.target.value)}
      className="cursor-pointer rounded-md border border-dashed border-border bg-transparent px-[5px] py-0.5 text-[11px] text-muted-foreground outline-none">
      <option value="">— vincular —</option>
      {days.map((d) => d.events.length > 0 && (
        <optgroup key={d.id} label={d.label}>
          {d.events.map((ev) => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
        </optgroup>
      ))}
    </select>
  );
}
