"use client";
import type { Extra, Day, RoomMember, Task } from "@/types";
import type { MockPerson } from "@/hooks/useRoom";
import { usdToCop, fmtUSDNum, fmtCOPNum, extraGroupUSD, optionGroupUSD } from "@/utils/currency";
import { TH_CLASS, SectionHeader } from "@/components/budget/shared";
import GlobalExtraRow from "@/components/budget/GlobalExtraRow";
import DayExtraRow from "@/components/budget/DayExtraRow";
import DayTimeline from "@/components/budget/DayTimeline";
import TravelersCard from "@/components/budget/TravelersCard";
import { cn } from "@/lib/utils";

interface BudgetViewProps {
  extras: Extra[];
  grandTotal: number;
  exchangeRate: number;
  members: RoomMember[];
  mockPeople: MockPerson[];
  days: Day[];
  tasks: Task[];
  onSetExchangeRate: (rate: number) => void;
  onUpdateExtra: (id: string, patch: Partial<Extra>) => void;
  onLinkExtra: (extraId: string, eventId: string | undefined) => void;
  onAddExtra: (partial?: Partial<Extra>) => void;
  onRemoveExtra: (id: string) => void;
  onAddMockPerson: (name: string) => void;
  onRemoveMockPerson: (id: string) => void;
}

const ADD_BTN = "w-full cursor-pointer rounded-[7px] border border-dashed border-border bg-transparent px-3.5 py-[5px] text-xs text-muted-foreground hover:text-foreground";

export default function BudgetView({
  extras, grandTotal, exchangeRate, members, mockPeople, days, tasks,
  onSetExchangeRate, onUpdateExtra, onLinkExtra, onAddExtra, onRemoveExtra,
  onAddMockPerson, onRemoveMockPerson,
}: BudgetViewProps) {
  const people   = Math.max(1, members.length + mockPeople.length);
  const totalCOP = usdToCop(grandTotal, exchangeRate);

  const globalExtras = extras.filter((e) => !e.startDayId && !e.linkedEventId);
  const dayExtras    = extras.filter((e) => !!e.startDayId);
  const linkedExtras = extras.filter((e) => !e.startDayId && !!e.linkedEventId);

  const globalTotal = [...globalExtras, ...linkedExtras].reduce((s, e) => s + extraGroupUSD(e, people, exchangeRate), 0);

  // Undecided option-tasks: shown apart, never summed into the confirmed total.
  const optionTasks = tasks
    .filter((t) => (t.options?.length ?? 0) > 0)
    .map((t) => {
      const costs = t.options!.map((o) => optionGroupUSD(o, people, exchangeRate));
      return { id: t.id, title: t.title, low: Math.min(...costs), high: Math.max(...costs), count: t.options!.length };
    });
  const rangeLow  = optionTasks.reduce((s, o) => s + o.low, 0);
  const rangeHigh = optionTasks.reduce((s, o) => s + o.high, 0);

  return (
    <div className="flex-1 overflow-y-auto px-9 py-7">

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold">Presupuesto del viaje</h2>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-[5px]">
          <span className="text-xs text-muted-foreground">TRM</span>
          <input type="number" value={exchangeRate} onChange={(e) => onSetExchangeRate(parseFloat(e.target.value) || 4000)}
            className="w-[72px] border-none bg-transparent text-right text-[13px] font-semibold text-foreground outline-none" />
        </div>
      </div>

      <TravelersCard
        members={members}
        mockPeople={mockPeople}
        people={people}
        onAddMockPerson={onAddMockPerson}
        onRemoveMockPerson={onRemoveMockPerson}
      />

      <SectionHeader label="GASTOS GLOBALES" hint="Costos fijos del viaje (tiquetes, crucero)" />
      <table className="mb-8 w-full border-collapse overflow-hidden rounded-xl border border-border bg-card">
        <thead>
          <tr>
            <th className={cn(TH_CLASS, "w-[26%] text-left")}>CONCEPTO</th>
            <th className={cn(TH_CLASS, "text-left")}>ACTIVIDAD</th>
            <th className={cn(TH_CLASS, "w-40 text-right")}>TOTAL GRUPO</th>
            <th className={cn(TH_CLASS, "w-[130px] text-right")}>POR PERSONA</th>
            <th className={cn(TH_CLASS, "w-[60px]")} />
          </tr>
        </thead>
        <tbody>
          {[...globalExtras, ...linkedExtras].map((e) => (
            <GlobalExtraRow key={e.id} extra={e} exchangeRate={exchangeRate} people={people} days={days}
              onCommit={(p) => onUpdateExtra(e.id, p)} onRemove={() => onRemoveExtra(e.id)} onLinkExtra={(eid) => onLinkExtra(e.id, eid)} />
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={5} className="border-t border-border px-3 py-2">
              <button onClick={() => onAddExtra()} className={ADD_BTN}>+ Añadir gasto global</button>
            </td>
          </tr>
          {(globalExtras.length > 0 || linkedExtras.length > 0) && (
            <tr className="bg-primary/5">
              <td colSpan={2} className="border-t-2 border-border px-3 py-2.5 text-[13px] font-bold">Subtotal</td>
              <td className="border-t-2 border-border px-3 py-2.5 text-right font-mono font-bold">${fmtUSDNum(globalTotal)}</td>
              <td className="border-t-2 border-border px-3 py-2.5 text-right font-mono font-bold">${fmtUSDNum(globalTotal / people)}</td>
              <td className="border-t-2 border-border" />
            </tr>
          )}
        </tfoot>
      </table>

      <SectionHeader label="GASTOS POR DÍA" hint="Hospedaje, comidas y excursiones distribuidas en el rango de días" />

      {dayExtras.length > 0 && (
        <table className="mb-4 w-full border-collapse overflow-hidden rounded-xl border border-border bg-card">
          <thead>
            <tr>
              <th className={cn(TH_CLASS, "w-[22%] text-left")}>CONCEPTO</th>
              <th className={cn(TH_CLASS, "text-left")}>RANGO</th>
              <th className={cn(TH_CLASS, "w-[170px] text-right")}>TOTAL / DIARIO</th>
              <th className={cn(TH_CLASS, "w-[130px] text-right")}>POR PERSONA</th>
              <th className={cn(TH_CLASS, "text-left")}>ACTIVIDAD</th>
              <th className={cn(TH_CLASS, "w-[60px]")} />
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
              <td colSpan={6} className="border-t border-border px-3 py-2">
                <button onClick={() => onAddExtra({ startDayId: days[0]?.id, endDayId: days[0]?.id })} className={ADD_BTN}>+ Añadir gasto por días</button>
              </td>
            </tr>
          </tfoot>
        </table>
      )}

      {(dayExtras.length > 0 || linkedExtras.length > 0) ? (
        <>
          <div className="mb-2.5 text-[11px] font-bold tracking-[.06em] text-muted-foreground">DISTRIBUCIÓN POR DÍA</div>
          <DayTimeline dayExtras={dayExtras} linkedExtras={linkedExtras} days={days} exchangeRate={exchangeRate} people={people} />
        </>
      ) : (
        <button onClick={() => onAddExtra({ startDayId: days[0]?.id, endDayId: days[0]?.id })}
          className="w-full cursor-pointer rounded-[10px] border border-dashed border-border bg-transparent p-5 text-center text-[13px] text-muted-foreground hover:text-foreground">
          + Añadir primer gasto por días<br />
          <span className="text-[11px] opacity-70">Hospedaje, comidas, excursiones…</span>
        </button>
      )}

      {optionTasks.length > 0 && (
        <div className="mt-8">
          <SectionHeader label="PENDIENTE DE DECIDIR" hint="Tareas con opciones sin elegir — no suman al total confirmado hasta que decidas" />
          <div className="overflow-hidden rounded-xl border border-dashed border-[#F59E0B66] bg-[#F59E0B0d]">
            {optionTasks.map((o) => (
              <div key={o.id} className="flex items-center justify-between border-b border-[#F59E0B22] px-4 py-2.5 last:border-b-0">
                <span className="text-[13px] text-foreground">🔀 {o.title} <span className="text-[11px] text-muted-foreground">· {o.count} opciones</span></span>
                <span className="font-mono text-[13px] font-semibold text-[#B45309]">
                  {o.low === o.high ? `$${fmtUSDNum(o.low)}` : `$${fmtUSDNum(o.low)} – $${fmtUSDNum(o.high)}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-7">
        <div className="rounded-xl border border-primary/40 bg-primary/10 px-5 py-4">
          <div className="mb-1.5 text-[11px] font-semibold tracking-[.06em] text-emerald-700">TOTAL DEL VIAJE</div>
          <div className="font-mono text-[22px] font-bold">{fmtUSDNum(grandTotal)} <span className="text-xs font-normal">USD</span></div>
          <div className="mt-0.5 font-mono text-[13px] text-secondary-foreground">{fmtCOPNum(totalCOP)} COP</div>
          <div className="mt-2.5 text-xs text-secondary-foreground">
            <span className="font-semibold">{fmtUSDNum(grandTotal / people)}</span> por persona · {fmtCOPNum(usdToCop(grandTotal / people, exchangeRate))} COP
          </div>
          {optionTasks.length > 0 && (
            <div className="mt-3 border-t border-primary/20 pt-2.5 text-xs text-secondary-foreground">
              Con lo pendiente por decidir, el viaje quedaría entre{" "}
              <span className="font-mono font-semibold text-foreground">{fmtUSDNum(grandTotal + rangeLow)}</span> y{" "}
              <span className="font-mono font-semibold text-foreground">{fmtUSDNum(grandTotal + rangeHigh)}</span> USD.
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
