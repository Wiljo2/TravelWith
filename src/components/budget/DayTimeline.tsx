"use client";
import type { Extra, Day } from "@/types";
import { fmtUSDNum, extraGroupUSD } from "@/utils/currency";
import { cn } from "@/lib/utils";

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

const TH = "whitespace-nowrap border-b border-border px-2.5 py-[7px] text-right text-[10px] font-bold tracking-[.05em] text-muted-foreground";
const TD = "whitespace-nowrap border-b border-border px-2.5 py-[7px] text-right font-mono text-xs text-secondary-foreground";
const TD_EMPTY = "text-muted-foreground opacity-50";

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

  return (
    <div className="overflow-x-auto rounded-[10px] border border-border bg-card">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className={cn(TH, "sticky left-0 z-[1] min-w-[150px] bg-card text-left")}>CONCEPTO</th>
            {days.map((d) => <th key={d.id} className={TH}>{d.label.split("·")[0].trim()}<br /><span className="font-normal opacity-70">{d.label.split("·")[1]?.trim()}</span></th>)}
          </tr>
        </thead>
        <tbody>
          {dayExtras.map((e) => (
            <tr key={e.id}>
              <td className={cn(TD, "sticky left-0 z-[1] bg-card text-left")}>{e.label}</td>
              {days.map((d) => {
                const v = perDayUSD(e, d.id, days, exchangeRate, people);
                return <td key={d.id} className={cn(TD, v === null && TD_EMPTY)}>{v !== null ? fmtUSDNum(v) : "—"}</td>;
              })}
            </tr>
          ))}
          {linkedExtras.map((e) => {
            const ld = linkedDay(e, days);
            return (
              <tr key={e.id}>
                <td className={cn(TD, "sticky left-0 z-[1] bg-card text-left")}>
                  <span className="mr-[5px] inline-block h-1.5 w-1.5 rounded-full bg-primary align-middle" />{e.label}
                </td>
                {days.map((d) => {
                  const isHere = ld?.id === d.id;
                  const v = isHere ? extraGroupUSD(e, people, exchangeRate) : null;
                  return <td key={d.id} className={cn(TD, !isHere && TD_EMPTY)}>{v !== null ? `$${fmtUSDNum(v)}` : "—"}</td>;
                })}
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="bg-primary/5">
            <td className="sticky left-0 z-[1] border-t-2 border-border bg-inherit px-2.5 py-2 text-xs font-bold">Total / día</td>
            {days.map((d) => {
              const t = dayTotal(d);
              return (
                <td key={d.id} className="whitespace-nowrap border-t-2 border-border px-2.5 py-2 text-right font-mono text-[13px] font-bold">
                  {t > 0
                    ? <>{fmtUSDNum(t)}<div className="text-[10px] font-normal text-muted-foreground">{fmtUSDNum(t / people)}/pax</div></>
                    : <span className="font-normal text-muted-foreground">—</span>}
                </td>
              );
            })}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
