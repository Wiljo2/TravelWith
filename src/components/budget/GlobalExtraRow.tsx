"use client";
import { useState } from "react";
import type { CSSProperties } from "react";
import type { Extra, Day } from "@/types";
import { fmtUSDNum, fmtCOPNum } from "@/utils/currency";
import {
  toUSD, toCOP, parse, actionBtn, calcNum, subLine,
  InlineNumber, CurrencyToggle, ModeToggle, EventLinkCell,
} from "@/components/budget/shared";
import type { Currency, SplitMode } from "@/components/budget/shared";

interface GlobalExtraRowProps {
  extra: Extra;
  exchangeRate: number;
  people: number;
  days: Day[];
  onCommit: (p: Partial<Extra>) => void;
  onRemove: () => void;
  onLinkExtra: (id: string | undefined) => void;
}

export default function GlobalExtraRow({
  extra, exchangeRate, people, days, onCommit, onRemove, onLinkExtra,
}: GlobalExtraRowProps) {
  const [label, setLabel]       = useState(extra.label);
  const [amount, setAmount]     = useState(extra.amount);
  const [currency, setCurrency] = useState<Currency>(extra.currency ?? "USD");
  const [mode, setMode]         = useState<SplitMode>(extra.splitMode ?? "group");
  const [dirty, setDirty]       = useState(false);

  const live     = dirty ? amount   : extra.amount;
  const liveCur  = dirty ? currency : (extra.currency ?? "USD");
  const liveMode = dirty ? mode     : (extra.splitMode ?? "group");

  // `live` holds the editable column's value: total in group mode, per-person otherwise.
  const unitUSD  = toUSD(live, liveCur, exchangeRate);
  const unitCOP  = toCOP(live, liveCur, exchangeRate);
  const groupUSD = liveMode === "perPerson" ? unitUSD * people : unitUSD;
  const groupCOP = liveMode === "perPerson" ? unitCOP * people : unitCOP;
  const paxUSD   = liveMode === "perPerson" ? unitUSD : unitUSD / people;
  const paxCOP   = liveMode === "perPerson" ? unitCOP : unitCOP / people;

  function toggleCurrency() {
    const next: Currency = liveCur === "USD" ? "COP" : "USD";
    setCurrency(next);
    setAmount(next === "COP" ? Math.round(live * exchangeRate) : Math.round(live / exchangeRate));
    setDirty(true);
  }
  function changeMode(next: SplitMode) {
    if (next === liveMode) return;
    setAmount(next === "perPerson" ? live / people : live * people);
    setMode(next);
    setDirty(true);
  }
  function commit() { onCommit({ amount, label, currency, splitMode: mode }); setDirty(false); }
  function cancel() { setLabel(extra.label); setAmount(extra.amount); setCurrency(extra.currency ?? "USD"); setMode(extra.splitMode ?? "group"); setDirty(false); }

  const cell: CSSProperties = { padding: "10px 12px", borderBottom: "1px solid var(--border)", verticalAlign: "middle" };

  return (
    <tr style={{ background: dirty ? "color-mix(in srgb, #6EE7B7 5%, transparent)" : undefined }}>
      <td style={cell}>
        <input value={label} onChange={(e) => { setLabel(e.target.value); setDirty(true); }}
          style={{ background: "none", border: "none", color: "var(--text-primary)", fontSize: 13, width: "100%", outline: "none" }} />
        <ModeToggle mode={liveMode} onChange={changeMode} />
      </td>
      <td style={cell}><EventLinkCell extra={extra} days={days} onLink={onLinkExtra} /></td>
      <td style={{ ...cell, textAlign: "right" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4 }}>
          <CurrencyToggle currency={liveCur} onClick={toggleCurrency} />
          {liveMode === "group"
            ? <InlineNumber value={liveCur === "USD" ? groupUSD : groupCOP} onChange={(raw) => { setAmount(parse(raw)); setDirty(true); }} />
            : <span style={calcNum} title="Calculado: por persona × viajeros">{liveCur === "USD" ? `$${fmtUSDNum(groupUSD)}` : fmtCOPNum(groupCOP)}</span>}
        </div>
        <div style={subLine}>{liveCur === "USD" ? `${fmtCOPNum(groupCOP)} COP` : `${fmtUSDNum(groupUSD)} USD`}</div>
      </td>
      <td style={{ ...cell, textAlign: "right" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 2 }}>
          {liveCur === "USD" && <span style={{ fontSize: 13, fontFamily: "monospace", color: "var(--text-muted)" }}>$</span>}
          {liveMode === "perPerson"
            ? <InlineNumber value={liveCur === "USD" ? paxUSD : paxCOP} onChange={(raw) => { setAmount(parse(raw)); setDirty(true); }} />
            : <span style={calcNum} title="Calculado: total ÷ viajeros">{liveCur === "USD" ? fmtUSDNum(paxUSD) : fmtCOPNum(paxCOP)}</span>}
          {liveCur === "COP" && <span style={{ fontSize: 10, color: "var(--text-muted)", marginLeft: 2 }}>COP</span>}
        </div>
        <div style={subLine}>
          {liveCur === "USD" ? `${fmtCOPNum(paxCOP)} COP` : `$${fmtUSDNum(paxUSD)} USD`}
        </div>
      </td>
      <td style={{ ...cell, width: 60, padding: "10px 6px" }}>
        <div style={{ display: "flex", gap: 3, justifyContent: "flex-end" }}>
          {dirty
            ? <><button onClick={commit} style={actionBtn("#6EE7B7", "#04342C")}>✓</button><button onClick={cancel} style={actionBtn("var(--surface-1)", "var(--text-muted)", true)}>✕</button></>
            : <button onClick={onRemove} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 15, width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", opacity: .4 }}>×</button>}
        </div>
      </td>
    </tr>
  );
}
