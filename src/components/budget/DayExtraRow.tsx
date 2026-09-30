"use client";
import { useState } from "react";
import type { Extra, Day } from "@/types";
import { fmtNum, fmtUSDNum, fmtCOPNum } from "@/utils/currency";
import {
  toUSD, toCOP, parse, CELL_CLASS, CALC_NUM_CLASS,
  InlineNumber, CurrencyToggle, ModeToggle, EventLinkCell,
  ROW_CLASS, CELL_FULL_CLASS, CELL_LABEL_CLASS, CELL_ACTIONS_CLASS, ACTION_BTN_CLASS,
} from "@/components/budget/shared";
import type { Currency, SplitMode } from "@/components/budget/shared";
import { cn } from "@/lib/utils";
import { LIMITS } from "@/constants/limits";

const SEL_CLASS = "cursor-pointer rounded-md border border-border bg-secondary px-1.5 py-[3px] text-[11px] text-foreground outline-none";

interface DayExtraRowProps {
  extra: Extra;
  exchangeRate: number;
  people: number;
  days: Day[];
  onCommit: (p: Partial<Extra>) => void;
  onRemove: () => void;
  onLinkExtra: (id: string | undefined) => void;
}

export default function DayExtraRow({
  extra, exchangeRate, people, days, onCommit, onRemove, onLinkExtra,
}: DayExtraRowProps) {
  const [label, setLabel]       = useState(extra.label);
  const [amount, setAmount]     = useState(extra.amount);
  const [currency, setCurrency] = useState<Currency>(extra.currency ?? "USD");
  const [mode, setMode]         = useState<SplitMode>(extra.splitMode ?? "group");
  const [startId, setStartId]   = useState(extra.startDayId ?? days[0]?.id ?? "");
  const [endId,   setEndId]     = useState(extra.endDayId ?? extra.startDayId ?? days[0]?.id ?? "");
  const [dirty, setDirty]       = useState(false);

  const liveCur  = dirty ? currency : (extra.currency ?? "USD");
  const live     = dirty ? amount   : extra.amount;
  const liveMode = dirty ? mode     : (extra.splitMode ?? "group");
  const si = days.findIndex((d) => d.id === startId);
  const ei = days.findIndex((d) => d.id === endId);
  const numDays = (si >= 0 && ei >= si) ? ei - si + 1 : 1;

  // `live` holds the editable column's value: total in group mode, per-person otherwise.
  const unitUSD  = toUSD(live, liveCur, exchangeRate);
  const unitCOP  = toCOP(live, liveCur, exchangeRate);
  const groupUSD = liveMode === "perPerson" ? unitUSD * people : unitUSD;
  const groupCOP = liveMode === "perPerson" ? unitCOP * people : unitCOP;
  const paxUSD   = liveMode === "perPerson" ? unitUSD : unitUSD / people;
  const paxCOP   = liveMode === "perPerson" ? unitCOP : unitCOP / people;
  const perDay   = groupUSD / numDays;

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
  function commit() { onCommit({ amount, label, currency, splitMode: mode, startDayId: startId, endDayId: endId || startId }); setDirty(false); }
  function cancel() {
    setLabel(extra.label); setAmount(extra.amount); setCurrency(extra.currency ?? "USD"); setMode(extra.splitMode ?? "group");
    setStartId(extra.startDayId ?? ""); setEndId(extra.endDayId ?? extra.startDayId ?? "");
    setDirty(false);
  }

  return (
    <tr className={cn(ROW_CLASS, dirty && "bg-primary/5")}>
      <td className={cn(CELL_CLASS, CELL_FULL_CLASS, "max-md:pr-24")}>
        <input value={label} maxLength={LIMITS.label} onChange={(e) => { setLabel(e.target.value); setDirty(true); }}
          className="w-full border-none bg-transparent text-[13px] text-foreground outline-none" />
        <ModeToggle mode={liveMode} onChange={changeMode} />
      </td>
      <td className={cn(CELL_CLASS, CELL_FULL_CLASS, CELL_LABEL_CLASS, "whitespace-nowrap")} data-label="RANGO">
        <div className="flex items-center gap-1">
          <select value={startId} onChange={(e) => { setStartId(e.target.value); setDirty(true); }} className={SEL_CLASS}>
            {days.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
          </select>
          <span className="text-[11px] text-muted-foreground">→</span>
          <select value={endId || startId} onChange={(e) => { setEndId(e.target.value); setDirty(true); }} className={SEL_CLASS}>
            {days.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
          </select>
        </div>
      </td>
      <td className={cn(CELL_CLASS, CELL_LABEL_CLASS, "text-right")} data-label="TOTAL / DIARIO">
        <div className="flex items-center justify-end gap-1">
          <CurrencyToggle currency={liveCur} onClick={toggleCurrency} />
          {liveMode === "group"
            ? <InlineNumber value={liveCur === "USD" ? groupUSD : groupCOP} onChange={(raw) => { setAmount(parse(raw)); setDirty(true); }} />
            : <span className={CALC_NUM_CLASS} title="Calculado: por persona × viajeros">{liveCur === "USD" ? fmtNum(groupUSD) : fmtNum(groupCOP)}</span>}
        </div>
        <div className="mt-px text-right font-mono text-[10px] text-muted-foreground">
          {numDays}d · {fmtUSDNum(perDay)}/día
        </div>
      </td>
      <td className={cn(CELL_CLASS, CELL_LABEL_CLASS, "text-right")} data-label="POR PERSONA">
        <div className="flex items-center justify-end gap-0.5">
          {liveCur === "USD" && <span className="font-mono text-[13px] text-muted-foreground">$</span>}
          {liveMode === "perPerson"
            ? <InlineNumber value={liveCur === "USD" ? paxUSD : paxCOP} onChange={(raw) => { setAmount(parse(raw)); setDirty(true); }} />
            : <span className={CALC_NUM_CLASS} title="Calculado: total ÷ viajeros">{fmtNum(liveCur === "USD" ? paxUSD : paxCOP)}</span>}
          {liveCur === "COP" && <span className="ml-0.5 text-[10px] text-muted-foreground">COP</span>}
        </div>
        <div className="mt-px text-right font-mono text-[10px] text-muted-foreground">
          {liveCur === "USD" ? `${fmtCOPNum(paxCOP / numDays)}/día` : `${fmtUSDNum(paxUSD / numDays)}/día`}
        </div>
      </td>
      <td className={cn(CELL_CLASS, CELL_FULL_CLASS, CELL_LABEL_CLASS)} data-label="ACTIVIDAD"><EventLinkCell extra={extra} days={days} onLink={onLinkExtra} /></td>
      <td className={cn(CELL_CLASS, CELL_ACTIONS_CLASS, "w-[60px] px-1.5")}>
        <div className="flex justify-end gap-[3px]">
          {dirty
            ? <>
                <button onClick={commit} className={cn(ACTION_BTN_CLASS, "bg-primary text-sm font-bold text-primary-foreground")}>✓</button>
                <button onClick={cancel} className={cn(ACTION_BTN_CLASS, "border border-border bg-secondary text-[13px] font-bold text-muted-foreground")}>✕</button>
              </>
            : <button onClick={onRemove} className={cn(ACTION_BTN_CLASS, "text-[15px] text-muted-foreground opacity-40 hover:opacity-100")}>×</button>}
        </div>
      </td>
    </tr>
  );
}
