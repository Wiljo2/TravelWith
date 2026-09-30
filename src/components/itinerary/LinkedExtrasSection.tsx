"use client";
import { useState } from "react";
import type { CalendarEvent, Extra } from "@/types";
import { fmtUSDNum } from "@/utils/currency";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LIMITS } from "@/constants/limits";

interface LinkedExtrasSectionProps {
  selectedEvent: { ev: CalendarEvent; dayId: string };
  extras: Extra[];
  onLinkExtra: (extraId: string, eventId: string | undefined) => void;
  onAddExtra: (partial?: Partial<Extra>) => void;
  onRemoveExtra: (id: string) => void;
}

function DeleteConfirm({ label, onUnlink, onDelete, onCancel }: {
  label: string;
  onUnlink: () => void;
  onDelete: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="mb-1.5 rounded-lg border border-border bg-secondary px-2.5 py-2">
      <p className="mb-2 text-xs text-foreground">
        ¿Qué hacemos con <strong>{label}</strong>?
      </p>
      <div className="flex flex-col gap-[5px]">
        <button onClick={onUnlink} className="cursor-pointer rounded-md border border-[#3B82F6] bg-[#3B82F622] py-[5px] text-[11px] font-medium text-[#3B82F6]">Solo desvincular</button>
        <button onClick={onDelete} className="cursor-pointer rounded-md border border-destructive bg-destructive/15 py-[5px] text-[11px] font-medium text-destructive">Eliminar del presupuesto</button>
        <button onClick={onCancel} className="cursor-pointer rounded-md border border-border bg-transparent py-[5px] text-[11px] font-medium text-muted-foreground">Cancelar</button>
      </div>
    </div>
  );
}

function AddGastoForm({ defaultLabel, onSave, onCancel }: {
  defaultLabel: string;
  onSave: (label: string, amount: number, currency: "USD" | "COP") => void;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState(defaultLabel);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<"USD" | "COP">("USD");

  function save() {
    const v = parseFloat(amount.replace(/\./g, "").replace(",", ".")) || 0;
    onSave(label, v, currency);
  }

  return (
    <div className="mt-1.5 rounded-lg border border-border bg-secondary p-2.5">
      <div className="mb-[7px] text-[11px] font-semibold tracking-[.06em] text-muted-foreground">NUEVO GASTO</div>
      <Input
        value={label}
        maxLength={LIMITS.label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Concepto"
        className="mb-1.5 bg-card text-xs"
      />
      <div className="mb-2 flex gap-[5px]">
        <button
          onClick={() => setCurrency((c) => c === "USD" ? "COP" : "USD")}
          className={cn(
            "shrink-0 cursor-pointer rounded-md border border-border px-2 py-[5px] text-[11px] font-bold",
            currency === "COP" ? "bg-[#4ADE8022] text-[#16A34A]" : "bg-[#60A5FA22] text-[#2563EB]",
          )}
        >
          {currency}
        </button>
        <Input
          autoFocus
          type="text" inputMode="numeric"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") onCancel(); }}
          placeholder="0"
          className="flex-1 bg-card text-right font-mono text-xs"
        />
      </div>
      <div className="flex gap-[5px]">
        <Button onClick={save} size="sm" className="flex-1 font-bold">✓ Guardar</Button>
        <Button variant="outline" size="sm" onClick={onCancel} className="text-muted-foreground">✕</Button>
      </div>
    </div>
  );
}

export default function LinkedExtrasSection({
  selectedEvent, extras, onLinkExtra, onAddExtra, onRemoveExtra,
}: LinkedExtrasSectionProps) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  const linked = extras.filter((x) => x.linkedEventId === selectedEvent.ev.id);
  const linkable = extras.filter((x) => x.linkedEventId !== selectedEvent.ev.id);

  return (
    <div>
      {linked.length === 0
        ? <p className="mb-2 text-xs text-muted-foreground">Sin gastos asignados</p>
        : (
          <div className="mb-2 flex flex-col gap-1">
            {linked.map((x) => {
              if (confirmDeleteId === x.id) {
                return (
                  <DeleteConfirm
                    key={x.id}
                    label={x.label}
                    onUnlink={() => { onLinkExtra(x.id, undefined); setConfirmDeleteId(null); }}
                    onDelete={() => { onRemoveExtra(x.id); setConfirmDeleteId(null); }}
                    onCancel={() => setConfirmDeleteId(null)}
                  />
                );
              }
              const displayAmt = x.currency === "COP"
                ? `${Math.round(x.amount).toLocaleString("es-CO")} COP`
                : fmtUSDNum(x.amount);
              return (
                <div key={x.id} className="flex items-center justify-between gap-3 text-[13px]">
                  <span className="min-w-0 truncate text-foreground">{x.label}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[11px] text-secondary-foreground">{displayAmt}</span>
                    <button
                      onClick={() => setConfirmDeleteId(x.id)}
                      className="cursor-pointer px-0.5 text-sm leading-none text-muted-foreground hover:text-foreground"
                    >×</button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      }

      {linkable.length > 0 && (
        <select value="" onChange={(e) => e.target.value && onLinkExtra(e.target.value, selectedEvent.ev.id)}
          className="mb-1.5 w-full cursor-pointer rounded-md border border-dashed border-border bg-secondary px-2 py-[5px] text-[11px] text-muted-foreground outline-none">
          <option value="">+ vincular gasto existente</option>
          {linkable.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
        </select>
      )}

      {showAddForm ? (
        <AddGastoForm
          defaultLabel={selectedEvent.ev.title}
          onSave={(label, amount, currency) => {
            onAddExtra({ label, amount, currency, linkedEventId: selectedEvent.ev.id });
            setShowAddForm(false);
          }}
          onCancel={() => setShowAddForm(false)}
        />
      ) : (
        <Button size="sm" variant="outline" onClick={() => setShowAddForm(true)} className="w-full text-xs font-medium">
          + Nuevo gasto para esta actividad
        </Button>
      )}
    </div>
  );
}
