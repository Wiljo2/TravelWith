"use client";
import { CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PANEL } from "@/components/home/shared";
import { cn } from "@/lib/utils";
import type { VoteTask } from "@/utils/votes";

interface DatesPendingProps {
  // The open dates vote, if there is one.
  vote: VoteTask | undefined;
  onOpenVote: () => void;
  onStartVote: () => void;
  className?: string;
}

// Itinerario of a trip without dates: there are no days to plan until the
// group votes on them, so it always offers the way there.
export default function DatesPending({ vote, onOpenVote, onStartVote, className }: DatesPendingProps) {
  const options = vote?.options?.length ?? 0;
  const hint = !vote
    ? "Propongan rangos de fechas y voten entre todos. Con las fechas elegidas armamos un día del itinerario por cada día del viaje."
    : options === 0
      ? "La votación está abierta en Inicio: propongan 2 o 3 rangos de fechas y voten con ✋."
      : `El grupo está votando en Inicio (${options} ${options === 1 ? "opción" : "opciones"}). Cuando el creador elija, aparecen los días del viaje.`;

  return (
    <section className={cn(PANEL, "flex flex-col items-start gap-3 sm:flex-row sm:items-center", className)}>
      <CalendarClock className="size-7 shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <h2 className="text-[15px] font-semibold">Primero decidamos las fechas</h2>
        <p className="mt-0.5 text-[13px] text-muted-foreground">{hint}</p>
      </div>
      <Button onClick={vote ? onOpenVote : onStartVote} className="rounded-full px-5 font-semibold">
        {vote ? "Ir a la votación" : <><span aria-hidden>🗳️</span> Votar las fechas</>}
      </Button>
    </section>
  );
}
