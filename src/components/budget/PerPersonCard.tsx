"use client";
import type { CSSProperties } from "react";
import type { Extra } from "@/types";
import { usdToCop, fmtUSDNum, fmtCOPNum, extraPerPersonUSD } from "@/utils/currency";

const td: CSSProperties = {
  padding: "5px 4px",
  borderBottom: "1px solid var(--border)",
  verticalAlign: "middle",
  fontSize: 12,
};

interface PerPersonCardProps {
  extras: Extra[];
  grandTotal: number;
  exchangeRate: number;
  people: number;
}

export default function PerPersonCard({ extras, grandTotal, exchangeRate, people }: PerPersonCardProps) {
  return (
    <div style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 10, padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>Por persona</div>
        <div style={{ fontSize: 10, color: "var(--text-muted)", background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: 20, padding: "2px 8px" }}>
          {people} {people === 1 ? "persona" : "personas"}
        </div>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          {extras.map((x) => {
            const pax = extraPerPersonUSD(x, people, exchangeRate);
            return (
              <tr key={x.id}>
                <td style={{ ...td, color: "var(--text-secondary)", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {x.linkedEventId && <span style={{ display: "inline-block", width: 5, height: 5, borderRadius: "50%", background: "#6EE7B7", marginRight: 4, verticalAlign: "middle" }} />}
                  {x.splitMode === "perPerson" && <span title="Por persona" style={{ display: "inline-block", fontSize: 9, fontWeight: 700, color: "#F59E0B", marginRight: 4 }}>/p</span>}
                  {x.label}
                </td>
                <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: "var(--text-primary)", whiteSpace: "nowrap" }}>
                  ${fmtUSDNum(pax)}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td style={{ paddingTop: 8, fontSize: 13, fontWeight: 600 }}>Total / pax</td>
            <td style={{ paddingTop: 8, textAlign: "right", fontSize: 13, fontWeight: 600, fontFamily: "monospace" }}>
              ${fmtUSDNum(grandTotal / people)}
            </td>
          </tr>
          <tr>
            <td colSpan={2} style={{ paddingTop: 1, textAlign: "right", fontSize: 11, color: "var(--text-muted)", fontFamily: "monospace" }}>
              {fmtCOPNum(usdToCop(grandTotal / people, exchangeRate))} COP
            </td>
          </tr>
        </tfoot>
      </table>

      <div style={{ marginTop: 10, fontSize: 11, color: "var(--text-muted)", textAlign: "center" }}>
        Edita los montos en la pestaña <strong>Presupuesto</strong>
      </div>
    </div>
  );
}
