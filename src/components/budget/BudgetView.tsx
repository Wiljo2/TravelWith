"use client";
import { useState } from "react";
import type { CSSProperties } from "react";
import type { Extra, Day, RoomMember } from "../../types";
import type { MockPerson } from "../../hooks/useRoom";
import { usdToCop, fmtUSDNum, fmtCOPNum, extraGroupUSD } from "../../utils/currency";
import { CATEGORIES } from "../../constants/categories";

type Currency = "USD" | "COP";
type SplitMode = "group" | "perPerson";

interface BudgetViewProps {
  extras: Extra[];
  grandTotal: number;
  exchangeRate: number;
  members: RoomMember[];
  mockPeople: MockPerson[];
  days: Day[];
  onSetExchangeRate: (rate: number) => void;
  onUpdateExtra: (id: string, patch: Partial<Extra>) => void;
  onLinkExtra: (extraId: string, eventId: string | undefined) => void;
  onAddExtra: (partial?: Partial<Extra>) => void;
  onRemoveExtra: (id: string) => void;
  onAddMockPerson: (name: string) => void;
  onRemoveMockPerson: (id: string) => void;
}

// ─── helpers ────────────────────────────────────────────────────────────────
function toUSD(amount: number, currency: Currency, rate: number) {
  return currency === "COP" ? amount / rate : amount;
}
function toCOP(amount: number, currency: Currency, rate: number) {
  return currency === "COP" ? amount : amount * rate;
}
function parse(raw: string) {
  return parseFloat(raw.replace(/\./g, "").replace(",", ".")) || 0;
}

// Per-day USD amount (group total) for a day-ranged extra, split-aware.
function perDayUSD(extra: Extra, dayId: string, days: Day[], rate: number, people: number): number | null {
  if (!extra.startDayId) return null;
  const si = days.findIndex((d) => d.id === extra.startDayId);
  const ei = days.findIndex((d) => d.id === (extra.endDayId ?? extra.startDayId));
  const di = days.findIndex((d) => d.id === dayId);
  if (si < 0 || ei < 0 || di < si || di > ei) return null;
  return extraGroupUSD(extra, people, rate) / (ei - si + 1);
}

// Day that contains the linked event
function linkedDay(extra: Extra, days: Day[]): Day | null {
  if (!extra.linkedEventId) return null;
  return days.find((d) => d.events.some((e) => e.id === extra.linkedEventId)) ?? null;
}

// ─── InlineNumber ────────────────────────────────────────────────────────────
function InlineNumber({ value, onChange, width = 80 }: { value: number; onChange: (raw: string) => void; width?: number }) {
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

// ─── EventLinkCell ───────────────────────────────────────────────────────────
function EventLinkCell({ extra, days, onLink }: { extra: Extra; days: Day[]; onLink: (id: string | undefined) => void }) {
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

// ─── CurrencyToggle ───────────────────────────────────────────────────────────
function CurrencyToggle({ currency, onClick }: { currency: Currency; onClick: () => void }) {
  return (
    <button onClick={onClick}
      style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 5, border: "1px solid var(--border)", background: currency === "COP" ? "#4ADE8022" : "#60A5FA22", color: currency === "COP" ? "#4ADE80" : "#60A5FA", cursor: "pointer", flexShrink: 0 }}>
      {currency}
    </button>
  );
}

function actionBtn(bg: string, color: string, bordered = false): CSSProperties {
  return { background: bg, border: bordered ? "1px solid var(--border)" : "none", borderRadius: 5, color, cursor: "pointer", fontSize: bordered ? 13 : 14, fontWeight: 700, width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center" };
}

// ─── ModeToggle — Grupal / Por persona ───────────────────────────────────────
// Grupal: el total es fijo y se divide → al sumar gente, el por-persona baja.
// Por persona: el costo unitario es fijo → al sumar gente, el total del grupo sube.
function ModeToggle({ mode, onChange }: { mode: SplitMode; onChange: (m: SplitMode) => void }) {
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

// Read-only cell value (the column that isn't editable in the current split mode).
const calcNum: CSSProperties = { width: 80, textAlign: "right", fontSize: 13, fontFamily: "monospace", color: "var(--text-muted)", fontStyle: "italic", display: "inline-block" };
const subLine: CSSProperties = { fontSize: 10, color: "var(--text-muted)", textAlign: "right", fontFamily: "monospace", marginTop: 1 };

// ─── GlobalExtraRow ───────────────────────────────────────────────────────────
function GlobalExtraRow({ extra, exchangeRate, people, days, onCommit, onRemove, onLinkExtra }: {
  extra: Extra; exchangeRate: number; people: number; days: Day[];
  onCommit: (p: Partial<Extra>) => void; onRemove: () => void; onLinkExtra: (id: string | undefined) => void;
}) {
  const [label, setLabel]     = useState(extra.label);
  const [amount, setAmount]   = useState(extra.amount);
  const [currency, setCurrency] = useState<Currency>(extra.currency ?? "USD");
  const [mode, setMode]       = useState<SplitMode>(extra.splitMode ?? "group");
  const [dirty, setDirty]     = useState(false);

  const live     = dirty ? amount   : extra.amount;
  const liveCur  = dirty ? currency : (extra.currency ?? "USD");
  const liveMode = dirty ? mode     : (extra.splitMode ?? "group");

  // `live` is the value of whichever column is editable (total if group, per-person if perPerson).
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
    // Keep the displayed total & per-person continuous at the switch.
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
      {/* TOTAL GRUPO — editable only in group mode */}
      <td style={{ ...cell, textAlign: "right" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4 }}>
          <CurrencyToggle currency={liveCur} onClick={toggleCurrency} />
          {liveMode === "group"
            ? <InlineNumber value={liveCur === "USD" ? groupUSD : groupCOP} onChange={(raw) => { setAmount(parse(raw)); setDirty(true); }} />
            : <span style={calcNum} title="Calculado: por persona × viajeros">{liveCur === "USD" ? `$${fmtUSDNum(groupUSD)}` : fmtCOPNum(groupCOP)}</span>}
        </div>
        <div style={subLine}>{liveCur === "USD" ? `${fmtCOPNum(groupCOP)} COP` : `${fmtUSDNum(groupUSD)} USD`}</div>
      </td>
      {/* POR PERSONA — editable only in perPerson mode */}
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

// ─── DayExtraRow ─────────────────────────────────────────────────────────────
function DayExtraRow({ extra, exchangeRate, people, days, onCommit, onRemove, onLinkExtra }: {
  extra: Extra; exchangeRate: number; people: number; days: Day[];
  onCommit: (p: Partial<Extra>) => void; onRemove: () => void; onLinkExtra: (id: string | undefined) => void;
}) {
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

  // `live` is the value of whichever column is editable (total if group, per-person if perPerson).
  const unitUSD    = toUSD(live, liveCur, exchangeRate);
  const unitCOP    = toCOP(live, liveCur, exchangeRate);
  const groupUSD   = liveMode === "perPerson" ? unitUSD * people : unitUSD;
  const groupCOP   = liveMode === "perPerson" ? unitCOP * people : unitCOP;
  const paxUSD     = liveMode === "perPerson" ? unitUSD : unitUSD / people;
  const paxCOP     = liveMode === "perPerson" ? unitCOP : unitCOP / people;
  const perDay     = groupUSD / numDays;

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

  const cell: CSSProperties = { padding: "10px 12px", borderBottom: "1px solid var(--border)", verticalAlign: "middle" };
  const sel: CSSProperties  = { fontSize: 11, background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: 6, padding: "3px 6px", color: "var(--text-primary)", outline: "none", cursor: "pointer" };

  return (
    <tr style={{ background: dirty ? "color-mix(in srgb, #6EE7B7 5%, transparent)" : undefined }}>
      <td style={cell}>
        <input value={label} onChange={(e) => { setLabel(e.target.value); setDirty(true); }}
          style={{ background: "none", border: "none", color: "var(--text-primary)", fontSize: 13, width: "100%", outline: "none" }} />
        <ModeToggle mode={liveMode} onChange={changeMode} />
      </td>
      {/* Day range */}
      <td style={{ ...cell, whiteSpace: "nowrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <select value={startId} onChange={(e) => { setStartId(e.target.value); setDirty(true); }} style={sel}>
            {days.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
          </select>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>→</span>
          <select value={endId || startId} onChange={(e) => { setEndId(e.target.value); setDirty(true); }} style={sel}>
            {days.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
          </select>
        </div>
      </td>
      {/* TOTAL / DIARIO — group total; editable only in group mode */}
      <td style={{ ...cell, textAlign: "right" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4 }}>
          <CurrencyToggle currency={liveCur} onClick={toggleCurrency} />
          {liveMode === "group"
            ? <InlineNumber value={liveCur === "USD" ? groupUSD : groupCOP} onChange={(raw) => { setAmount(parse(raw)); setDirty(true); }} />
            : <span style={calcNum} title="Calculado: por persona × viajeros">{liveCur === "USD" ? `$${fmtUSDNum(groupUSD)}` : fmtCOPNum(groupCOP)}</span>}
        </div>
        <div style={{ fontSize: 10, color: "var(--text-muted)", textAlign: "right", fontFamily: "monospace", marginTop: 1 }}>
          {numDays}d · ${fmtUSDNum(perDay)}/día
        </div>
      </td>
      {/* POR PERSONA — editable only in perPerson mode */}
      <td style={{ ...cell, textAlign: "right" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 2 }}>
          {liveCur === "USD" && <span style={{ fontSize: 13, fontFamily: "monospace", color: "var(--text-muted)" }}>$</span>}
          {liveMode === "perPerson"
            ? <InlineNumber value={liveCur === "USD" ? paxUSD : paxCOP} onChange={(raw) => { setAmount(parse(raw)); setDirty(true); }} />
            : <span style={calcNum} title="Calculado: total ÷ viajeros">{liveCur === "USD" ? fmtUSDNum(paxUSD) : fmtCOPNum(paxCOP)}</span>}
          {liveCur === "COP" && <span style={{ fontSize: 10, color: "var(--text-muted)", marginLeft: 2 }}>COP</span>}
        </div>
        <div style={{ fontSize: 10, color: "var(--text-muted)", textAlign: "right", fontFamily: "monospace", marginTop: 1 }}>
          {liveCur === "USD" ? `${fmtCOPNum(paxCOP / numDays)}/día` : `$${fmtUSDNum(paxUSD / numDays)}/día`}
        </div>
      </td>
      {/* Activity link */}
      <td style={cell}><EventLinkCell extra={extra} days={days} onLink={onLinkExtra} /></td>
      {/* Actions */}
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

// ─── DayTimeline ─────────────────────────────────────────────────────────────
function DayTimeline({ dayExtras, linkedExtras, days, exchangeRate, people }: {
  dayExtras: Extra[]; linkedExtras: Extra[]; days: Day[]; exchangeRate: number; people: number;
}) {
  function dayTotal(day: Day): number {
    let s = 0;
    for (const e of dayExtras) {
      const v = perDayUSD(e, day.id, days, exchangeRate, people);
      if (v !== null) s += v;
    }
    for (const e of linkedExtras) {
      if (linkedDay(e, days)?.id === day.id) s += extraGroupUSD(e, people, exchangeRate);
    }
    return s;
  }

  const thC: CSSProperties = { padding: "7px 10px", fontSize: 10, color: "var(--text-muted)", fontWeight: 700, letterSpacing: ".05em", borderBottom: "1px solid var(--border)", textAlign: "right", whiteSpace: "nowrap" };
  const tdC: CSSProperties = { padding: "7px 10px", fontSize: 12, fontFamily: "monospace", textAlign: "right", borderBottom: "1px solid var(--border)", color: "var(--text-secondary)", whiteSpace: "nowrap" };
  const tdE: CSSProperties = { ...tdC, color: "var(--text-muted)", opacity: .5 };

  return (
    <div style={{ overflowX: "auto", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface-2)" }}>
      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            <th style={{ ...thC, textAlign: "left", minWidth: 150, position: "sticky", left: 0, background: "var(--surface-2)", zIndex: 1 }}>CONCEPTO</th>
            {days.map((d) => <th key={d.id} style={thC}>{d.label.split("·")[0].trim()}<br /><span style={{ fontWeight: 400, opacity: .7 }}>{d.label.split("·")[1]?.trim()}</span></th>)}
          </tr>
        </thead>
        <tbody>
          {dayExtras.map((e) => (
            <tr key={e.id}>
              <td style={{ ...tdC, textAlign: "left", position: "sticky", left: 0, background: "var(--surface-2)", zIndex: 1 }}>{e.label}</td>
              {days.map((d) => {
                const v = perDayUSD(e, d.id, days, exchangeRate, people);
                return <td key={d.id} style={v !== null ? tdC : tdE}>{v !== null ? fmtUSDNum(v) : "—"}</td>;
              })}
            </tr>
          ))}
          {linkedExtras.map((e) => {
            const ld = linkedDay(e, days);
            return (
              <tr key={e.id}>
                <td style={{ ...tdC, textAlign: "left", position: "sticky", left: 0, background: "var(--surface-2)", zIndex: 1 }}>
                  <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "#6EE7B7", marginRight: 5, verticalAlign: "middle" }} />{e.label}
                </td>
                {days.map((d) => {
                  const isHere = ld?.id === d.id;
                  const v = isHere ? extraGroupUSD(e, people, exchangeRate) : null;
                  return <td key={d.id} style={isHere ? tdC : tdE}>{v !== null ? `$${fmtUSDNum(v)}` : "—"}</td>;
                })}
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr style={{ background: "color-mix(in srgb, #6EE7B7 6%, transparent)" }}>
            <td style={{ padding: "8px 10px", fontSize: 12, fontWeight: 700, borderTop: "2px solid var(--border)", position: "sticky", left: 0, background: "inherit", zIndex: 1 }}>Total / día</td>
            {days.map((d) => {
              const t = dayTotal(d);
              return (
                <td key={d.id} style={{ padding: "8px 10px", textAlign: "right", fontFamily: "monospace", fontWeight: 700, borderTop: "2px solid var(--border)", fontSize: 13, whiteSpace: "nowrap" }}>
                  {t > 0
                    ? <>{fmtUSDNum(t)}<div style={{ fontSize: 10, fontWeight: 400, color: "var(--text-muted)" }}>{fmtUSDNum(t / people)}/pax</div></>
                    : <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>—</span>}
                </td>
              );
            })}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ─── MemberAvatar ────────────────────────────────────────────────────────────
function MemberAvatar({ member, size = 26 }: { member: RoomMember; size?: number }) {
  return member.avatar ? (
    <img src={member.avatar} alt={member.name} width={size} height={size} style={{ borderRadius: "50%", border: "2px solid var(--surface-1)", display: "block", flexShrink: 0 }} />
  ) : (
    <div style={{ width: size, height: size, borderRadius: "50%", background: "#6EE7B7", border: "2px solid var(--surface-1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.4, fontWeight: 700, color: "#04342C", flexShrink: 0 }}>
      {member.name[0].toUpperCase()}
    </div>
  );
}

// ─── SectionHeader ────────────────────────────────────────────────────────────
function SectionHeader({ label, hint }: { label: string; hint: string }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".06em" }}>{label}</div>
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{hint}</div>
    </div>
  );
}

const TH: CSSProperties = { padding: "10px 12px", fontSize: 11, color: "var(--text-muted)", fontWeight: 600, letterSpacing: ".06em", borderBottom: "1px solid var(--border)" };

// ─── BudgetView ──────────────────────────────────────────────────────────────
export default function BudgetView({
  extras, grandTotal, exchangeRate, members, mockPeople, days,
  onSetExchangeRate, onUpdateExtra, onLinkExtra, onAddExtra, onRemoveExtra,
  onAddMockPerson, onRemoveMockPerson,
}: BudgetViewProps) {
  const [addingMock, setAddingMock] = useState(false);
  const [mockName, setMockName]     = useState("");

  const people   = Math.max(1, members.length + mockPeople.length);
  const totalCOP = usdToCop(grandTotal, exchangeRate);

  // Partition extras
  const globalExtras = extras.filter((e) => !e.startDayId && !e.linkedEventId);
  const dayExtras    = extras.filter((e) => !!e.startDayId);
  const linkedExtras = extras.filter((e) => !e.startDayId && !!e.linkedEventId);

  function submitMock() {
    const name = mockName.trim();
    if (name) onAddMockPerson(name);
    setMockName(""); setAddingMock(false);
  }

  // Global subtotal: includes linked extras (linked to an event ≠ spread over days)
  const globalTotal = [...globalExtras, ...linkedExtras].reduce((s, e) => s + extraGroupUSD(e, people, exchangeRate), 0);

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "28px 36px" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Presupuesto del viaje</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, padding: "5px 12px" }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>TRM</span>
          <input type="number" value={exchangeRate} onChange={(e) => onSetExchangeRate(parseFloat(e.target.value) || 4000)}
            style={{ width: 72, background: "none", border: "none", color: "var(--text-primary)", fontSize: 13, fontWeight: 600, textAlign: "right", outline: "none" }} />
        </div>
      </div>

      {/* Viajeros */}
      <div style={{ marginBottom: 28, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 18px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: people > 0 || addingMock ? 10 : 0 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", letterSpacing: ".06em" }}>VIAJEROS</span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ background: "color-mix(in srgb, #6EE7B7 15%, transparent)", border: "1px solid #6EE7B7", borderRadius: 20, padding: "2px 10px", fontSize: 12, fontWeight: 600, color: "#6EE7B7" }}>{people} {people === 1 ? "persona" : "personas"}</div>
            {!addingMock && <button onClick={() => setAddingMock(true)} style={{ background: "var(--surface-1)", border: "1px dashed var(--border)", borderRadius: 7, padding: "3px 10px", fontSize: 12, color: "var(--text-muted)", cursor: "pointer" }}>+ persona</button>}
          </div>
        </div>
        {members.map((m) => (
          <div key={m.userId} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <MemberAvatar member={m} /><span style={{ fontSize: 13 }}>{m.name}</span>
            <span style={{ fontSize: 10, color: "var(--text-muted)", background: "var(--surface-1)", borderRadius: 4, padding: "1px 5px" }}>miembro</span>
          </div>
        ))}
        {mockPeople.map((p) => (
          <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <div style={{ width: 26, height: 26, borderRadius: "50%", border: "2px dashed var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", background: "var(--surface-1)", flexShrink: 0 }}>{p.name[0].toUpperCase()}</div>
            <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{p.name}</span>
            <span style={{ fontSize: 10, color: "var(--text-muted)", background: "var(--surface-1)", borderRadius: 4, padding: "1px 5px" }}>simulado</span>
            <button onClick={() => onRemoveMockPerson(p.id)} style={{ marginLeft: "auto", background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 15, lineHeight: 1, padding: "0 4px" }}>×</button>
          </div>
        ))}
        {addingMock && (
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <input autoFocus value={mockName} onChange={(e) => setMockName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submitMock(); if (e.key === "Escape") { setAddingMock(false); setMockName(""); } }}
              placeholder="Nombre del viajero"
              style={{ flex: 1, padding: "6px 10px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--surface-1)", color: "var(--text-primary)", fontSize: 13, outline: "none" }} />
            <button onClick={submitMock} style={{ padding: "6px 14px", borderRadius: 7, border: "none", background: "#6EE7B7", color: "#04342C", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>Agregar</button>
            <button onClick={() => { setAddingMock(false); setMockName(""); }} style={{ padding: "6px 10px", borderRadius: 7, border: "1px solid var(--border)", background: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 13 }}>×</button>
          </div>
        )}
      </div>

      {/* ── GASTOS GLOBALES ── */}
      <SectionHeader label="GASTOS GLOBALES" hint="Costos fijos del viaje (tiquetes, crucero)" />
      <table style={{ width: "100%", borderCollapse: "collapse", background: "var(--surface-2)", borderRadius: 12, overflow: "hidden", border: "1px solid var(--border)", marginBottom: 32 }}>
        <thead>
          <tr>
            <th style={{ ...TH, textAlign: "left", width: "26%" }}>CONCEPTO</th>
            <th style={{ ...TH, textAlign: "left" }}>ACTIVIDAD</th>
            <th style={{ ...TH, textAlign: "right", width: 160 }}>TOTAL GRUPO</th>
            <th style={{ ...TH, textAlign: "right", width: 130 }}>POR PERSONA</th>
            <th style={{ ...TH, width: 60 }} />
          </tr>
        </thead>
        <tbody>
          {globalExtras.map((e) => (
            <GlobalExtraRow key={e.id} extra={e} exchangeRate={exchangeRate} people={people} days={days}
              onCommit={(p) => onUpdateExtra(e.id, p)} onRemove={() => onRemoveExtra(e.id)} onLinkExtra={(eid) => onLinkExtra(e.id, eid)} />
          ))}
          {linkedExtras.map((e) => (
            <GlobalExtraRow key={e.id} extra={e} exchangeRate={exchangeRate} people={people} days={days}
              onCommit={(p) => onUpdateExtra(e.id, p)} onRemove={() => onRemoveExtra(e.id)} onLinkExtra={(eid) => onLinkExtra(e.id, eid)} />
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={5} style={{ padding: "8px 12px", borderTop: "1px solid var(--border)" }}>
              <button onClick={() => onAddExtra()} style={{ background: "none", border: "1px dashed var(--border)", borderRadius: 7, padding: "5px 14px", fontSize: 12, color: "var(--text-muted)", cursor: "pointer", width: "100%" }}>+ Añadir gasto global</button>
            </td>
          </tr>
          {(globalExtras.length > 0 || linkedExtras.length > 0) && (
            <tr style={{ background: "color-mix(in srgb, #6EE7B7 6%, transparent)" }}>
              <td colSpan={2} style={{ padding: "10px 12px", fontWeight: 700, fontSize: 13, borderTop: "2px solid var(--border)" }}>Subtotal</td>
              <td style={{ padding: "10px 12px", textAlign: "right", borderTop: "2px solid var(--border)", fontFamily: "monospace", fontWeight: 700 }}>${fmtUSDNum(globalTotal)}</td>
              <td style={{ padding: "10px 12px", textAlign: "right", borderTop: "2px solid var(--border)", fontFamily: "monospace", fontWeight: 700 }}>${fmtUSDNum(globalTotal / people)}</td>
              <td style={{ borderTop: "2px solid var(--border)" }} />
            </tr>
          )}
        </tfoot>
      </table>

      {/* ── GASTOS POR DÍA ── */}
      <SectionHeader label="GASTOS POR DÍA" hint="Hospedaje, comidas y excursiones distribuidas en el rango de días" />

      {dayExtras.length > 0 && (
        <table style={{ width: "100%", borderCollapse: "collapse", background: "var(--surface-2)", borderRadius: 12, overflow: "hidden", border: "1px solid var(--border)", marginBottom: 16 }}>
          <thead>
            <tr>
              <th style={{ ...TH, textAlign: "left", width: "22%" }}>CONCEPTO</th>
              <th style={{ ...TH, textAlign: "left" }}>RANGO</th>
              <th style={{ ...TH, textAlign: "right", width: 170 }}>TOTAL / DIARIO</th>
              <th style={{ ...TH, textAlign: "right", width: 130 }}>POR PERSONA</th>
              <th style={{ ...TH, textAlign: "left" }}>ACTIVIDAD</th>
              <th style={{ ...TH, width: 60 }} />
            </tr>
          </thead>
          <tbody>
            {dayExtras.map((e) => (
              <DayExtraRow key={e.id} extra={e} exchangeRate={exchangeRate} people={people} days={days}
                onCommit={(p) => onUpdateExtra(e.id, p)} onRemove={() => onRemoveExtra(e.id)} onLinkExtra={(eid) => onLinkExtra(e.id, eid)} />
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={6} style={{ padding: "8px 12px", borderTop: "1px solid var(--border)" }}>
                <button onClick={() => onAddExtra({ startDayId: days[0]?.id, endDayId: days[0]?.id })}
                  style={{ background: "none", border: "1px dashed var(--border)", borderRadius: 7, padding: "5px 14px", fontSize: 12, color: "var(--text-muted)", cursor: "pointer", width: "100%" }}>+ Añadir gasto por días</button>
              </td>
            </tr>
          </tfoot>
        </table>
      )}

      {/* Timeline distribution */}
      {(dayExtras.length > 0 || linkedExtras.length > 0) ? (
        <>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: ".06em", marginBottom: 10 }}>DISTRIBUCIÓN POR DÍA</div>
          <DayTimeline dayExtras={dayExtras} linkedExtras={linkedExtras} days={days} exchangeRate={exchangeRate} people={people} />
        </>
      ) : (
        <button onClick={() => onAddExtra({ startDayId: days[0]?.id, endDayId: days[0]?.id })}
          style={{ background: "none", border: "1px dashed var(--border)", borderRadius: 10, padding: "20px", fontSize: 13, color: "var(--text-muted)", cursor: "pointer", width: "100%", textAlign: "center" }}>
          + Añadir primer gasto por días<br />
          <span style={{ fontSize: 11, opacity: .7 }}>Hospedaje, comidas, excursiones…</span>
        </button>
      )}

      {/* Grand total */}
      <div style={{ marginTop: 28 }}>
        <div style={{ background: "color-mix(in srgb, #6EE7B7 10%, transparent)", border: "1px solid rgba(110,231,183,.4)", borderRadius: 12, padding: "16px 20px" }}>
          <div style={{ fontSize: 11, color: "#6EE7B7", fontWeight: 600, marginBottom: 6, letterSpacing: ".06em" }}>TOTAL DEL VIAJE</div>
          <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "monospace" }}>{fmtUSDNum(grandTotal)} <span style={{ fontSize: 12, fontWeight: 400 }}>USD</span></div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", fontFamily: "monospace", marginTop: 2 }}>{fmtCOPNum(totalCOP)} COP</div>
          <div style={{ marginTop: 10, fontSize: 12, color: "var(--text-secondary)" }}>
            <span style={{ fontWeight: 600 }}>{fmtUSDNum(grandTotal / people)}</span> por persona · {fmtCOPNum(usdToCop(grandTotal / people, exchangeRate))} COP
          </div>
        </div>
      </div>

    </div>
  );
}
