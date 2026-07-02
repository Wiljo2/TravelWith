"use client";
import type { Extra, Day, RoomMember } from "@/types";
import type { MockPerson } from "@/hooks/useRoom";
import { usdToCop, fmtUSDNum, fmtCOPNum, extraGroupUSD } from "@/utils/currency";
import { TH, SectionHeader } from "@/components/budget/shared";
import GlobalExtraRow from "@/components/budget/GlobalExtraRow";
import DayExtraRow from "@/components/budget/DayExtraRow";
import DayTimeline from "@/components/budget/DayTimeline";
import TravelersCard from "@/components/budget/TravelersCard";

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

export default function BudgetView({
  extras, grandTotal, exchangeRate, members, mockPeople, days,
  onSetExchangeRate, onUpdateExtra, onLinkExtra, onAddExtra, onRemoveExtra,
  onAddMockPerson, onRemoveMockPerson,
}: BudgetViewProps) {
  const people   = Math.max(1, members.length + mockPeople.length);
  const totalCOP = usdToCop(grandTotal, exchangeRate);

  const globalExtras = extras.filter((e) => !e.startDayId && !e.linkedEventId);
  const dayExtras    = extras.filter((e) => !!e.startDayId);
  const linkedExtras = extras.filter((e) => !e.startDayId && !!e.linkedEventId);

  const globalTotal = [...globalExtras, ...linkedExtras].reduce((s, e) => s + extraGroupUSD(e, people, exchangeRate), 0);

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "28px 36px" }}>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Presupuesto del viaje</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, padding: "5px 12px" }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>TRM</span>
          <input type="number" value={exchangeRate} onChange={(e) => onSetExchangeRate(parseFloat(e.target.value) || 4000)}
            style={{ width: 72, background: "none", border: "none", color: "var(--text-primary)", fontSize: 13, fontWeight: 600, textAlign: "right", outline: "none" }} />
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
          {[...globalExtras, ...linkedExtras].map((e) => (
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
