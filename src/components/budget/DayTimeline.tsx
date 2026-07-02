"use client";
import type { CSSProperties } from "react";
import type { Extra, Day } from "@/types";
import { fmtUSDNum, extraGroupUSD } from "@/utils/currency";

// Per-day USD amount (group total) for a day-ranged extra, split-aware.
export function perDayUSD(extra: Extra, dayId: string, days: Day[], rate: number, people: number): number | null {
  if (!extra.startDayId) return null;
  const si = days.findIndex((d) => d.id === extra.startDayId);
  const ei = days.findIndex((d) => d.id === (extra.endDayId ?? extra.startDayId));
  const di = days.findIndex((d) => d.id === dayId);
  if (si < 0 || ei < 0 || di < si || di > ei) return null;
  return extraGroupUSD(extra, people, rate) / (ei - si + 1);
}

export function linkedDay(extra: Extra, days: Day[]): Day | null {
  if (!extra.linkedEventId) return null;
  return days.find((d) => d.events.some((e) => e.id === extra.linkedEventId)) ?? null;
}

interface DayTimelineProps {
  dayExtras: Extra[];
  linkedExtras: Extra[];
  days: Day[];
  exchangeRate: number;
  people: number;
}

export default function DayTimeline({ dayExtras, linkedExtras, days, exchangeRate, people }: DayTimelineProps) {
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
