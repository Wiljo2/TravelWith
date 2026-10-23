"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import type { TaskDecides, TaskOption } from "@/types";
import type { ProposedOption } from "@/hooks/useVotes";
import DateRangeFields from "@/components/DateRangeFields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LIMITS } from "@/constants/limits";
import { VOTE_KINDS } from "@/constants/votes";
import { generateDays } from "@/utils/tripDays";
import { alreadyProposed, dateOptionLabel } from "@/utils/votes";

interface ProposeOptionProps {
  kind: TaskDecides;
  options: TaskOption[];
  onPropose: (option: ProposedOption) => void;
}

// "+ Agregar fechas" / "+ Agregar destino": anyone on the trip can propose, up to LIMITS.voteOptions.
export default function ProposeOption({ kind, options, onPropose }: ProposeOptionProps) {
  const [open, setOpen] = useState(false);
  const [dates, setDates] = useState({ startDate: "", endDate: "" });
  const [name, setName] = useState("");

  if (options.length >= LIMITS.voteOptions) {
    return <p className="text-[11px] text-muted-foreground">Ya hay {LIMITS.voteOptions} opciones, el máximo. Quiten una para proponer otra.</p>;
  }
  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="self-start rounded-full border-dashed bg-card">
        <Plus /> {VOTE_KINDS[kind].propose}
      </Button>
    );
  }

  const dayCount = dates.startDate && dates.endDate ? generateDays(dates.startDate, dates.endDate)?.length ?? null : null;
  const proposal: ProposedOption | null = kind === "dates"
    ? dayCount ? { label: dateOptionLabel(dates.startDate, dates.endDate), ...dates } : null
    : name.trim() ? { label: name.trim() } : null;
  const duplicate = !!proposal && alreadyProposed(options, proposal);

  function close() {
    setOpen(false);
    setDates({ startDate: "", endDate: "" });
    setName("");
  }

  function submit() {
    if (!proposal || duplicate) return;
    onPropose(proposal);
    close();
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border p-2.5">
      {kind === "dates" ? (
        <DateRangeFields {...dates} dayCount={dayCount} onChange={(d) => setDates((prev) => ({ ...prev, ...d }))} />
      ) : (
        <Input
          autoFocus
          value={name}
          maxLength={LIMITS.name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") close(); }}
          placeholder="Ej. Cartagena"
          className="h-10 bg-secondary text-[13px]"
        />
      )}
      {duplicate && (
        <p className="text-xs text-muted-foreground">{kind === "dates" ? "Esas fechas ya están propuestas." : "Ese destino ya está propuesto."}</p>
      )}
      <div className="flex justify-end gap-1.5">
        <Button variant="ghost" size="sm" onClick={close}>Cancelar</Button>
        <Button size="sm" onClick={submit} disabled={!proposal || duplicate} className="font-semibold">Agregar</Button>
      </div>
    </div>
  );
}
