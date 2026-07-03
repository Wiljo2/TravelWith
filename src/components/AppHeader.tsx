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

  return (
    <div className="mb-3.5 flex flex-wrap items-end justify-between gap-3.5">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#D85A30]">
          {eyebrow}
        </div>
        <h1 className="mt-0.5 text-2xl font-semibold text-foreground">
          {title}
        </h1>
        <div className="mt-1 text-[13px] text-secondary-foreground">
          Arrastra cualquier bloque para reorganizar el plan · clic para editar horas
        </div>
      </div>
      <div className="flex items-center gap-3">
        {roomCode !== "LOCAL" && (
          <div className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs">
            <span className={cn("h-[7px] w-[7px] shrink-0 rounded-full", connected ? "bg-primary" : "bg-gray-500")} />
            <span className="text-muted-foreground">Sala</span>
            <span className="font-mono font-bold tracking-wider">{roomCode}</span>
            <span className={cn("min-w-[52px] text-left text-[10px]", saveState === "error" ? "text-destructive" : "text-muted-foreground")}>
              {SAVE_LABEL[saveState]}
            </span>
            <button
              title="Restablecer itinerario al default"
              onClick={onReset}
              className="cursor-pointer pl-1 text-xs text-muted-foreground hover:text-foreground"
            >↺</button>
            <button
              onClick={onLeaveRoom}
              className="cursor-pointer pl-1 text-[13px] text-muted-foreground hover:text-foreground"
            >×</button>
          </div>
        )}
        <div className="flex flex-wrap gap-2.5">
          <PriceChip label="Total estimado" value={fmtUSD(grandTotal)} sub={fmtCOP(usdToCop(grandTotal, exchangeRate))} strong />
        </div>
        <AuthButton />
      </div>
    </div>
  );
}
