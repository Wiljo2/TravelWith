"use client";
import { useState } from "react";
import type { CSSProperties } from "react";
import type { Extra, Day } from "@/types";
import { CATEGORIES } from "@/constants/categories";

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

export const TH: CSSProperties = { padding: "10px 12px", fontSize: 11, color: "var(--text-muted)", fontWeight: 600, letterSpacing: ".06em", borderBottom: "1px solid var(--border)" };

export const calcNum: CSSProperties = { width: 80, textAlign: "right", fontSize: 13, fontFamily: "monospace", color: "var(--text-muted)", fontStyle: "italic", display: "inline-block" };

export const subLine: CSSProperties = { fontSize: 10, color: "var(--text-muted)", textAlign: "right", fontFamily: "monospace", marginTop: 1 };

export function actionBtn(bg: string, color: string, bordered = false): CSSProperties {
  return { background: bg, border: bordered ? "1px solid var(--border)" : "none", borderRadius: 5, color, cursor: "pointer", fontSize: bordered ? 13 : 14, fontWeight: 700, width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center" };
}

export function SectionHeader({ label, hint }: { label: string; hint: string }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".06em" }}>{label}</div>
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{hint}</div>
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
      style={{ width, background: "none", border: "none", color: "var(--text-primary)", fontSize: 13, fontFamily: "monospace", textAlign: "right", outline: "none" }}
    />
  );
}

export function CurrencyToggle({ currency, onClick }: { currency: Currency; onClick: () => void }) {
  return (
    <button onClick={onClick}
      style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 5, border: "1px solid var(--border)", background: currency === "COP" ? "#4ADE8022" : "#60A5FA22", color: currency === "COP" ? "#4ADE80" : "#60A5FA", cursor: "pointer", flexShrink: 0 }}>
      {currency}
    </button>
  );
}

// Grupal: fixed total split across people. Por persona: unit cost that scales with people.
export function ModeToggle({ mode, onChange }: { mode: SplitMode; onChange: (m: SplitMode) => void }) {
  const opts: { id: SplitMode; label: string; color: string }[] = [
    { id: "group",     label: "Grupal",      color: "#60A5FA" },
    { id: "perPerson", label: "Por persona", color: "#F59E0B" },
  ];
  return (
    <div style={{ display: "inline-flex", marginTop: 6, borderRadius: 6, overflow: "hidden", border: "1px solid var(--border)" }}>
      {opts.map((o) => (
        <button key={o.id} onClick={() => onChange(o.id)} type="button"
          title={o.id === "group" ? "Total fijo, se divide entre viajeros" : "Costo por viajero, escala con la cantidad"}
          style={{
            padding: "2px 8px", fontSize: 10, fontWeight: 600, cursor: "pointer", border: "none", lineHeight: 1.6,
            background: mode === o.id ? `${o.color}22` : "transparent",
            color: mode === o.id ? o.color : "var(--text-muted)",
          }}>
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
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, padding: "2px 7px 2px 5px", borderRadius: 20, background: cat?.bg ?? "var(--surface-1)", border: `1px solid ${cat?.border ?? "var(--border)"}`, color: cat?.text ?? "var(--text-secondary)", maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: cat?.dot ?? "#888", flexShrink: 0 }} />
          {linked.ev.title}
        </span>
        <button onClick={() => onLink(undefined)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 13, lineHeight: 1, padding: 0 }}>×</button>
      </div>
    );
  }
  return (
    <select value="" onChange={(e) => e.target.value && onLink(e.target.value)}
      style={{ fontSize: 11, color: "var(--text-muted)", background: "transparent", border: "1px dashed var(--border)", borderRadius: 6, padding: "2px 5px", cursor: "pointer", outline: "none" }}>
      <option value="">— vincular —</option>
      {days.map((d) => d.events.length > 0 && (
        <optgroup key={d.id} label={d.label}>
          {d.events.map((ev) => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
        </optgroup>
      ))}
    </select>
  );
}
