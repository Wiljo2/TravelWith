"use client";
import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { AgentAction, AgentDecision, AgentPending } from "@/types";

interface AgentConfirmCardProps {
  pending: AgentPending;
  streaming: boolean;
  onDecide: (decisions: AgentDecision[]) => void;
}

function ActionIcon({ action }: { action: AgentAction }) {
  if (action.kind === "delete") return <Trash2 className="size-3.5 shrink-0" aria-label="Eliminar" />;
  if (action.name.startsWith("create_") || action.name === "add_expense") return <Plus className="size-3.5 shrink-0" aria-label="Crear" />;
  return <Pencil className="size-3.5 shrink-0" aria-label="Modificar" />;
}

function statusLine(pending: AgentPending): string {
  if (pending.status === "expired") return "Expiró — pide el cambio de nuevo";
  if (pending.status === "rejected") return "Rechazado";
  const approved = pending.decisions?.filter((d) => d.approve).length ?? 0;
  return approved === pending.actions.length ? "Aprobado" : `Aprobados ${approved} de ${pending.actions.length}`;
}

export default function AgentConfirmCard({ pending, streaming, onDecide }: AgentConfirmCardProps) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const locked = pending.status !== "pending";
  const isChecked = (id: string) =>
    locked ? (pending.decisions?.find((d) => d.id === id)?.approve ?? false) : (checked[id] ?? true);
  const approvedCount = pending.actions.filter((a) => isChecked(a.id)).length;

  function submit(approveAll: boolean) {
    onDecide(pending.actions.map((a) => ({ id: a.id, approve: approveAll && isChecked(a.id) })));
  }

  return (
    <div className="space-y-2 rounded-lg border border-border bg-card px-2.5 py-2">
      <div className="text-[11.5px] font-semibold text-foreground">Cambios propuestos ({pending.actions.length})</div>
      <ul className="space-y-1.5">
        {pending.actions.map((action) => {
          const inputId = `agent-action-${pending.token.slice(-8)}-${action.id}`;
          return (
            <li key={action.id} className="flex items-start gap-2">
              <Checkbox
                id={inputId}
                checked={isChecked(action.id)}
                disabled={locked || streaming}
                onCheckedChange={(value) => setChecked((prev) => ({ ...prev, [action.id]: value }))}
                className="mt-0.5"
              />
              <label
                htmlFor={inputId}
                className={cn(
                  "flex min-w-0 flex-1 cursor-pointer items-start gap-1.5 text-xs leading-normal",
                  action.kind === "delete" ? "text-destructive" : "text-foreground",
                  locked && "cursor-default",
                )}
              >
                <span className="mt-0.5">
                  <ActionIcon action={action} />
                </span>
                <span className="min-w-0 break-words">{action.summary}</span>
              </label>
            </li>
          );
        })}
      </ul>
      {locked ? (
        <div className="text-[11px] text-muted-foreground">{statusLine(pending)}</div>
      ) : (
        <div className="flex gap-1.5">
          <Button size="sm" disabled={streaming || approvedCount === 0} onClick={() => submit(true)}>
            Aprobar ({approvedCount})
          </Button>
          <Button size="sm" variant="outline" disabled={streaming} onClick={() => submit(false)}>
            Rechazar todo
          </Button>
        </div>
      )}
    </div>
  );
}
