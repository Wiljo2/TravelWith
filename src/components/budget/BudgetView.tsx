"use client";
import type { Extra, Day, RoomMember, Task } from "@/types";
import type { MockPerson } from "@/hooks/useRoom";
import { usdToCop, fmtUSD, fmtCOP, fmtUSDNum, extraGroupUSD, optionGroupUSD } from "@/utils/currency";
import { TH_CLASS, TABLE_CLASS, THEAD_CLASS, TBODY_CLASS, TFOOT_CLASS, SectionHeader } from "@/components/budget/shared";
import GlobalExtraRow from "@/components/budget/GlobalExtraRow";
import DayExtraRow from "@/components/budget/DayExtraRow";
import DayTimeline from "@/components/budget/DayTimeline";
import TravelersCard from "@/components/budget/TravelersCard";
import { PANEL } from "@/components/home/shared";
import { Disclosure } from "@/components/ui/disclosure";
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

const ADD_BTN = "w-full cursor-pointer rounded-lg border border-dashed border-border bg-transparent px-3.5 py-2 text-[13px] text-muted-foreground hover:text-foreground";
// Tables sit flush inside their card; the title keeps the card padding.
const TABLE_PANEL = cn(PANEL, "overflow-hidden p-0 md:p-0");
const TABLE_HEAD = "px-4 pt-4 md:px-5 md:pt-5";

export default function BudgetView({
  extras, grandTotal, exchangeRate, members, mockPeople, days, tasks,
  onSetExchangeRate, onUpdateExtra, onLinkExtra, onAddExtra, onRemoveExtra,
  onAddMockPerson, onRemoveMockPerson,
}: BudgetViewProps) {
  const people   = Math.max(1, members.length + mockPeople.length);

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
  const addDayExtra = () => onAddExtra({ startDayId: days[0]?.id, endDayId: days[0]?.id });

  return (
    <div className="flex flex-col gap-4 md:gap-5">
      <section className={cn(PANEL, "bg-linear-to-br from-accent to-card")}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[28px] font-semibold leading-tight tracking-tight md:text-[34px]">
              {fmtUSD(grandTotal / people)}
              <span className="ml-2 text-sm font-normal text-secondary-foreground">por persona</span>
            </div>
            <div className="mt-1 text-sm text-secondary-foreground">
              {fmtUSD(grandTotal)} en total · {fmtCOP(usdToCop(grandTotal, exchangeRate))}
            </div>
          </div>
          <label className="flex items-center gap-2 rounded-full bg-card px-3 py-1.5 text-xs text-muted-foreground ring-1 ring-border">
            TRM
            <input type="number" value={exchangeRate} onChange={(e) => onSetExchangeRate(parseFloat(e.target.value) || 4000)}
              className="w-[64px] border-none bg-transparent text-right text-[13px] font-semibold text-foreground outline-none" />
          </label>
        </div>
        {optionTasks.length > 0 && (
          <p className="mt-3 border-t border-foreground/10 pt-3 text-[13px] text-secondary-foreground">
            Con lo pendiente por decidir quedaría entre{" "}
            <strong className="font-semibold text-foreground">{fmtUSD((grandTotal + rangeLow) / people)}</strong> y{" "}
            <strong className="font-semibold text-foreground">{fmtUSD((grandTotal + rangeHigh) / people)}</strong> por persona.
          </p>
        )}
      </section>

      <div className={cn("grid grid-cols-[minmax(0,1fr)] gap-4 md:gap-5", optionTasks.length > 0 && "md:grid-cols-2")}>
        <TravelersCard
          members={members}
          mockPeople={mockPeople}
          people={people}
          onAddMockPerson={onAddMockPerson}
          onRemoveMockPerson={onRemoveMockPerson}
        />

        {optionTasks.length > 0 && (
          <section className={PANEL}>
            <SectionHeader label="Pendiente de decidir" hint="No suma al total hasta que elijan una opción" />
            <ul className="flex flex-col divide-y divide-border">
              {optionTasks.map((o) => (
                <li key={o.id} className="flex items-baseline justify-between gap-3 py-2">
                  <span className="min-w-0 text-[13px]">
                    {o.title} <span className="text-xs text-muted-foreground">· {o.count} opciones</span>
                  </span>
                  <span className="shrink-0 text-[13px] font-semibold tabular-nums text-[#B45309]">
                    {o.low === o.high ? fmtUSDNum(o.low) : `${fmtUSDNum(o.low)}–${fmtUSDNum(o.high)}`}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

          <section className={TABLE_PANEL}>
            <SectionHeader className={TABLE_HEAD} label="Gastos globales" hint="Costos fijos del viaje: tiquetes, crucero, hoteles" />
            <table className={TABLE_CLASS}>
              <thead className={THEAD_CLASS}>
                <tr>
                  <th className={cn(TH_CLASS, "w-[26%] text-left")}>CONCEPTO</th>
                  <th className={cn(TH_CLASS, "text-left")}>ACTIVIDAD</th>
                  <th className={cn(TH_CLASS, "w-40 text-right")}>TOTAL GRUPO</th>
                  <th className={cn(TH_CLASS, "w-[130px] text-right")}>POR PERSONA</th>
                  <th className={cn(TH_CLASS, "w-[60px]")} />
                </tr>
              </thead>
              <tbody className={TBODY_CLASS}>
                {[...globalExtras, ...linkedExtras].map((e) => (
                  <GlobalExtraRow key={e.id} extra={e} exchangeRate={exchangeRate} people={people} days={days}
                    onCommit={(p) => onUpdateExtra(e.id, p)} onRemove={() => onRemoveExtra(e.id)} onLinkExtra={(eid) => onLinkExtra(e.id, eid)} />
                ))}
              </tbody>
              <tfoot className={TFOOT_CLASS}>
                <tr>
                  <td colSpan={5} className="px-4 py-3">
                    <button onClick={() => onAddExtra()} className={ADD_BTN}>+ Añadir gasto global</button>
                  </td>
                </tr>
                {(globalExtras.length > 0 || linkedExtras.length > 0) && (
                  <tr className="bg-secondary">
                    <td colSpan={2} className="px-4 py-3 text-[13px] font-semibold max-md:flex-1">Subtotal</td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums">{fmtUSDNum(globalTotal)}</td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums">
                      {fmtUSDNum(globalTotal / people)}<span className="block text-[10px] font-normal text-muted-foreground md:hidden">por persona</span>
                    </td>
                    <td className="max-md:hidden" />
                  </tr>
                )}
              </tfoot>
            </table>
          </section>

          <section className={TABLE_PANEL}>
            <SectionHeader className={TABLE_HEAD} label="Gastos por día" hint="Hospedaje, comidas y excursiones repartidas en un rango de días" />
            {dayExtras.length > 0 ? (
              <div className="md:overflow-x-auto">
              <table className={cn(TABLE_CLASS, "md:min-w-[760px]")}>
                <thead className={THEAD_CLASS}>
                  <tr>
                    <th className={cn(TH_CLASS, "w-[22%] text-left")}>CONCEPTO</th>
                    <th className={cn(TH_CLASS, "text-left")}>RANGO</th>
                    <th className={cn(TH_CLASS, "w-[170px] text-right")}>TOTAL / DIARIO</th>
                    <th className={cn(TH_CLASS, "w-[130px] text-right")}>POR PERSONA</th>
                    <th className={cn(TH_CLASS, "text-left")}>ACTIVIDAD</th>
                    <th className={cn(TH_CLASS, "w-[60px]")} />
                  </tr>
                </thead>
                <tbody className={TBODY_CLASS}>
                  {dayExtras.map((e) => (
                    <DayExtraRow key={e.id} extra={e} exchangeRate={exchangeRate} people={people} days={days}
                      onCommit={(p) => onUpdateExtra(e.id, p)} onRemove={() => onRemoveExtra(e.id)} onLinkExtra={(eid) => onLinkExtra(e.id, eid)} />
                  ))}
                </tbody>
                <tfoot className={TFOOT_CLASS}>
                  <tr>
                    <td colSpan={6} className="px-4 py-3">
                      <button onClick={addDayExtra} className={ADD_BTN}>+ Añadir gasto por días</button>
                    </td>
                  </tr>
                </tfoot>
              </table>
              </div>
            ) : (
              <div className="px-4 pb-4 md:px-5 md:pb-5">
                <button onClick={addDayExtra} className={cn(ADD_BTN, "py-5")}>
                  + Añadir primer gasto por días<br />
                  <span className="text-xs opacity-70">Hospedaje, comidas, excursiones…</span>
                </button>
              </div>
            )}
          </section>

          {(dayExtras.length > 0 || linkedExtras.length > 0) && (
            <section className={cn(PANEL, "py-1 md:py-1")}>
              <Disclosure title="Distribución por día" hint="Cuánto se gasta cada día" className="border-t-0">
                <DayTimeline dayExtras={dayExtras} linkedExtras={linkedExtras} days={days} exchangeRate={exchangeRate} people={people} />
              </Disclosure>
            </section>
          )}
    </div>
  );
}
