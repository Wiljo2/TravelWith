"use client";
import type { Extra } from "@/types";
import { usdToCop, fmtUSDNum, fmtCOPNum, extraPerPersonUSD } from "@/utils/currency";

const TD = "border-b border-border px-1 py-[5px] align-middle text-xs";

interface PerPersonCardProps {
  extras: Extra[];
  grandTotal: number;
  exchangeRate: number;
  people: number;
}

export default function PerPersonCard({ extras, grandTotal, exchangeRate, people }: PerPersonCardProps) {
  return (
    <div className="rounded-[10px] border border-border bg-card p-3.5">
      <div className="mb-2.5 flex items-center justify-between">
        <div className="text-[13px] font-semibold">Por persona</div>
        <div className="rounded-full border border-border bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">
          {people} {people === 1 ? "persona" : "personas"}
        </div>
      </div>

      <table className="w-full border-collapse">
        <tbody>
          {extras.map((x) => {
            const pax = extraPerPersonUSD(x, people, exchangeRate);
            return (
              <tr key={x.id}>
                <td className={`${TD} max-w-[120px] truncate text-secondary-foreground`}>
                  {x.linkedEventId && <span className="mr-1 inline-block h-[5px] w-[5px] rounded-full bg-primary align-middle" />}
                  {x.splitMode === "perPerson" && <span title="Por persona" className="mr-1 inline-block text-[9px] font-bold text-[#B45309]">/p</span>}
                  {x.label}
                </td>
                <td className={`${TD} whitespace-nowrap text-right font-mono text-foreground`}>
                  ${fmtUSDNum(pax)}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td className="pt-2 text-[13px] font-semibold">Total / pax</td>
            <td className="pt-2 text-right font-mono text-[13px] font-semibold">
              ${fmtUSDNum(grandTotal / people)}
            </td>
          </tr>
          <tr>
            <td colSpan={2} className="pt-px text-right font-mono text-[11px] text-muted-foreground">
              {fmtCOPNum(usdToCop(grandTotal / people, exchangeRate))} COP
            </td>
          </tr>
        </tfoot>
      </table>

      <div className="mt-2.5 text-center text-[11px] text-muted-foreground">
        Edita los montos en la pestaña <strong>Presupuesto</strong>
      </div>
    </div>
  );
}
