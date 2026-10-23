"use client";
import type { TaskOption } from "@/types";
import { optionGroupUSD, fmtUSDNum } from "@/utils/currency";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import OptionVote, { type OptionVoting } from "@/components/tasks/OptionVote";
import { LIMITS } from "@/constants/limits";
import { leader, namesText, voteCount, voterNames } from "@/utils/votes";

type Currency = "USD" | "COP";
type SplitMode = "group" | "perPerson";

function parseAmount(raw: string): number {
  return parseFloat(raw.replace(/\./g, "").replace(",", ".")) || 0;
}

interface TaskOptionsProps {
  options: TaskOption[];
  people: number;
  exchangeRate: number;
  scheduled: boolean; // whether choosing will also place an activity on the calendar
  closed: boolean;    // the task is done: its options take no more votes
  voting: OptionVoting;
  onChange: (options: TaskOption[]) => void;
  onChoose: (optionId: string) => void;
}

export default function TaskOptions({ options, people, exchangeRate, scheduled, closed, voting, onChange, onChoose }: TaskOptionsProps) {
  const memberIds = voting.members.map((m) => m.userId);
  const top = leader(options, memberIds);

  function patch(id: string, p: Partial<TaskOption>) {
    onChange(options.map((o) => (o.id === id ? { ...o, ...p } : o)));
  }
  function add() {
    onChange([...options, { id: crypto.randomUUID(), label: "", currency: "USD", splitMode: "group" }]);
  }
  function remove(o: TaskOption) {
    const votes = voteCount(o, memberIds);
    if (votes > 0 && !confirm(`Esta opción tiene ${votes} ${votes === 1 ? "voto" : "votos"}. ¿Quitarla de todas formas?`)) return;
    onChange(options.filter((x) => x.id !== o.id));
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-semibold tracking-[.06em] text-muted-foreground">
          OPCIONES {options.length > 0 && <span className="text-[#F59E0B]">· sin elegir</span>}
        </div>
      </div>

      {options.map((o) => {
        const cur = o.currency ?? "USD";
        const split = o.splitMode ?? "group";
        const perPerson = optionGroupUSD(o, people, exchangeRate) / Math.max(1, people);
        const voters = voterNames(o, voting.members, voting.voter);
        return (
          <div key={o.id} className="flex flex-col gap-1.5 rounded-md border border-dashed border-border bg-secondary p-2">
            <div className="flex items-center gap-1.5">
              <Input
                value={o.label}
                maxLength={LIMITS.label}
                onChange={(e) => patch(o.id, { label: e.target.value })}
                placeholder="Opción (ej. Universal Studios)"
                className="h-7 flex-1 bg-card text-xs"
              />
              <button onClick={() => remove(o)} title="Quitar opción"
                className="cursor-pointer px-1 text-sm leading-none text-muted-foreground hover:text-foreground">×</button>
            </div>

            <div className="flex items-center gap-1.5">
              <CurrencyToggle currency={cur} onClick={() => patch(o.id, { currency: cur === "USD" ? "COP" : "USD" })} />
              <Input
                inputMode="numeric"
                key={o.amount ?? 0}
                defaultValue={o.amount ? String(o.amount) : ""}
                onBlur={(e) => patch(o.id, { amount: parseAmount(e.target.value) })}
                placeholder="Precio"
                className="h-7 flex-1 bg-card text-right font-mono text-xs"
              />
              <SplitToggle mode={split} onClick={() => patch(o.id, { splitMode: split === "group" ? "perPerson" : "group" })} />
            </div>

            <Input
              value={o.note ?? ""}
              maxLength={LIMITS.note}
              onChange={(e) => patch(o.id, { note: e.target.value })}
              placeholder="Nota o link…"
              className="h-7 bg-card text-xs"
            />

            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 font-mono text-[10px] text-muted-foreground">
                {fmtUSDNum(optionGroupUSD(o, people, exchangeRate))} grupo · {fmtUSDNum(perPerson)}/persona
              </span>
              <div className="flex shrink-0 items-center gap-1.5">
                <OptionVote option={o} voting={voting} disabled={closed || !o.label.trim()} />
                <button
                  onClick={() => onChoose(o.id)}
                  disabled={!o.label.trim()}
                  className="cursor-pointer rounded-md bg-primary px-2 py-0.5 text-[10.5px] font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40"
                  title={scheduled ? "Confirma como actividad en el calendario" : "Confirma y suma al presupuesto"}
                >
                  ✓ Elegir
                </button>
              </div>
            </div>

            {voters.length > 0 && (
              <div className="flex min-w-0 items-center gap-1.5 text-[10px] text-muted-foreground">
                {top?.id === o.id && (
                  <Badge variant="outline" className="h-4 rounded-full border-primary bg-primary/15 px-1.5 text-[9.5px] font-semibold text-emerald-800">
                    Más votada
                  </Badge>
                )}
                <span className="truncate">✋ {namesText(voters)}</span>
              </div>
            )}
          </div>
        );
      })}

      <button onClick={add}
        className="cursor-pointer rounded-md border border-dashed border-border bg-transparent py-1 text-[11px] text-muted-foreground hover:text-foreground">
        + Agregar opción
      </button>

      {options.length > 0 && (
        <p className="text-[10px] leading-snug text-muted-foreground">
          Voten con ✋ las que les sirvan (pueden votar por varias). Al elegir una opción, la tarea se confirma {scheduled ? "como actividad en el calendario" : "y su costo entra al presupuesto"}. Las opciones no elegidas no suman al total.
        </p>
      )}
    </div>
  );
}

function CurrencyToggle({ currency, onClick }: { currency: Currency; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={cn(
        "shrink-0 cursor-pointer rounded-[5px] border border-border px-1.5 py-1 text-[10px] font-bold",
        currency === "COP" ? "bg-[#4ADE8022] text-[#16A34A]" : "bg-[#60A5FA22] text-[#2563EB]",
      )}>
      {currency}
    </button>
  );
}

function SplitToggle({ mode, onClick }: { mode: SplitMode; onClick: () => void }) {
  return (
    <button onClick={onClick}
      title={mode === "group" ? "Total del grupo" : "Por persona"}
      className={cn(
        "shrink-0 cursor-pointer rounded-[5px] border border-border px-1.5 py-1 text-[10px] font-semibold",
        mode === "perPerson" ? "bg-[#F59E0B22] text-[#B45309]" : "bg-transparent text-muted-foreground",
      )}>
      {mode === "group" ? "grupo" : "/pax"}
    </button>
  );
}
