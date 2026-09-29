"use client";
import AuthButton from "@/components/auth/AuthButton";
import PriceChip from "@/components/budget/PriceChip";
import { usdToCop, fmtUSD, fmtCOP } from "@/utils/currency";
import { fmtTripDates } from "@/utils/tripDays";
import { cn } from "@/lib/utils";
import type { SaveState } from "@/hooks/useRoom";
import type { TripInfo } from "@/types";

interface AppHeaderProps {
  roomCode: string;
  connected: boolean;
  saveState: SaveState;
  trip: TripInfo | null;
  grandTotal: number;
  exchangeRate: number;
  onReset: () => void;
  onLeaveRoom: () => void;
}

// Shown for the LOCAL demo room, which has no trip metadata
const DEMO = {
  eyebrow: "Wonder of the Seas · Orlando · Miami · Bahamas · CocoCay",
  title: "Bahamas & Perfect Day · Nov 26 – Dic 4, 2026",
};

const SAVE_LABEL: Record<SaveState, string> = {
  idle: "",
  saving: "guardando…",
  saved: "guardado ✓",
  error: "error ⚠",
};

export default function AppHeader({
  roomCode, connected, saveState, trip, grandTotal, exchangeRate, onReset, onLeaveRoom,
}: AppHeaderProps) {
  const eyebrow = trip ? (trip.destination ?? "Viaje en grupo") : DEMO.eyebrow;
  const title = trip
    ? `${trip.name} · ${fmtTripDates(trip.startDate, trip.endDate)}`
    : DEMO.title;

  const total = fmtUSD(grandTotal);
  const totalCop = fmtCOP(usdToCop(grandTotal, exchangeRate));

  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-x-3.5 gap-y-2.5 md:mb-3.5">
      <div className="flex w-full min-w-0 items-start gap-3 md:w-auto">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[11px] font-semibold uppercase tracking-[0.08em] text-[#D85A30]">
            {eyebrow}
          </div>
          <h1 className="mt-0.5 text-lg font-semibold leading-snug text-foreground md:text-2xl">
            {title}
          </h1>
          <div className="mt-1 hidden text-[13px] text-secondary-foreground md:block">
            Arrastra cualquier bloque para reorganizar el plan · clic para editar horas
          </div>
        </div>
        <PriceChip label="Total estimado" value={total} sub={totalCop} strong className="min-w-0 shrink-0 px-3 py-1.5 md:hidden" />
      </div>
      <div className="flex w-full items-center justify-between gap-3 md:w-auto md:justify-start">
        {roomCode !== "LOCAL" && (
          <div className="flex items-center gap-1.5 rounded-lg border border-border bg-card py-1 pl-3 pr-1 text-xs md:py-1.5 md:pr-3">
            <span className={cn("h-[7px] w-[7px] shrink-0 rounded-full", connected ? "bg-primary" : "bg-gray-500")} />
            <span className="hidden text-muted-foreground md:inline">Sala</span>
            <span className="font-mono font-bold tracking-wider">{roomCode}</span>
            <span className={cn("min-w-[52px] text-left text-[10px]", saveState === "error" ? "text-destructive" : "text-muted-foreground")}>
              {SAVE_LABEL[saveState]}
            </span>
            <button
              title="Restablecer itinerario al default"
              onClick={onReset}
              className="flex h-7 w-7 cursor-pointer items-center justify-center text-xs text-muted-foreground hover:text-foreground md:h-auto md:w-auto md:pl-1"
            >↺</button>
            <button
              title="Salir de la sala"
              onClick={onLeaveRoom}
              className="flex h-7 w-7 cursor-pointer items-center justify-center text-[13px] text-muted-foreground hover:text-foreground md:h-auto md:w-auto md:pl-1"
            >×</button>
          </div>
        )}
        <div className="hidden flex-wrap gap-2.5 md:flex">
          <PriceChip label="Total estimado" value={total} sub={totalCop} strong />
        </div>
        <AuthButton />
      </div>
    </div>
  );
}
