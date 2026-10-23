"use client";
import { useState } from "react";
import type { TripInfo } from "@/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { VOTE_KINDS } from "@/constants/votes";
import { cn } from "@/lib/utils";
import { UNDATED_LABEL, fmtTripDates, hasDates } from "@/utils/tripDays";
import { closedVoteChanges, leader, optionDayCount, ranked, type VoteTask } from "@/utils/votes";

interface CloseVoteDialogProps {
  task: VoteTask;
  optionId: string;
  memberIds: string[];
  trip: TripInfo | null;
  // Activities a dates close deletes (the days are rebuilt, as "Restablecer itinerario" does).
  activityCount: number;
  onConfirm: (optionId: string, replace: boolean) => void;
  onClose: () => void;
}

// The owner settles the vote: the trip takes the chosen dates or destination.
// Mounted only while open, so the choice starts at the option they tapped.
export default function CloseVoteDialog({ task, optionId, memberIds, trip, activityCount, onConfirm, onClose }: CloseVoteDialogProps) {
  const [selected, setSelected] = useState(optionId);
  const kind = VOTE_KINDS[task.decides];
  const options = ranked(task.options ?? [], memberIds);
  const top = leader(task.options ?? [], memberIds);
  const tie = !top && (options[0]?.votes ?? 0) > 0;
  const replace = task.decides === "dates" && activityCount > 0;
  // An option without a valid range (or removed meanwhile) can't settle the vote.
  const settles = (id: string) => {
    const o = task.options?.find((x) => x.id === id);
    return !!o && closedVoteChanges(task, o, trip) !== null;
  };
  const current = task.decides === "dates"
    ? hasDates(trip) ? fmtTripDates(trip.startDate, trip.endDate) : UNDATED_LABEL
    : trip?.destination;

  function submit() {
    if (!settles(selected)) return;
    onConfirm(selected, replace);
    onClose();
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-[400px]">
        <DialogHeader>
          <DialogTitle>{kind.close}</DialogTitle>
          <DialogDescription>
            {task.decides === "dates"
              ? "El viaje queda con estas fechas, el itinerario se arma con un día por fecha y la votación se cierra."
              : "El viaje queda con este destino y la votación se cierra."}
            {current && <> Ahora: {current}.</>}
          </DialogDescription>
        </DialogHeader>

        <div role="radiogroup" aria-label="Opciones" className="flex flex-col gap-1.5">
          {options.map(({ option: o, votes }) => {
            const days = optionDayCount(o);
            return (
              <button
                key={o.id}
                role="radio"
                aria-checked={selected === o.id}
                disabled={!settles(o.id)}
                onClick={() => setSelected(o.id)}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-left disabled:cursor-not-allowed disabled:opacity-40",
                  selected === o.id ? "border-primary bg-primary/10" : "border-border bg-card hover:bg-secondary",
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{o.label}</span>
                  {days && <span className="block text-[11px] text-muted-foreground">{days} {days === 1 ? "día" : "días"}</span>}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">✋ {votes}</span>
              </button>
            );
          })}
        </div>
        {tie && <p className="text-xs text-muted-foreground">Hay empate: tú decides.</p>}

        {replace && (
          <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
            Se borrarán {activityCount} {activityCount === 1 ? "actividad" : "actividades"} del itinerario.
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button variant={replace ? "destructive" : "default"} onClick={submit} disabled={!settles(selected)} className="font-semibold">
            {replace ? `Elegir y borrar ${activityCount} ${activityCount === 1 ? "actividad" : "actividades"}` : "Elegir"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
