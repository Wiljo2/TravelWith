"use client";
import { useState } from "react";
import { Menu } from "@base-ui/react/menu";
import { Copy, Ellipsis, FileDown, History, LogOut, RotateCcw } from "lucide-react";
import AuthButton from "@/components/auth/AuthButton";
import { fmtTripDates } from "@/utils/tripDays";
import { cn } from "@/lib/utils";
import type { SyncState } from "@/hooks/useTripOps";
import { useNow } from "@/hooks/useNow";
import { savedAgo, syncLabel } from "@/utils/syncLabel";
import type { TripInfo } from "@/types";
import type { ReportKind } from "@/utils/tripReport";

interface AppHeaderProps {
  roomCode: string;
  connected: boolean;
  saveState: SyncState;
  lastSavedAt: number | null;
  trip: TripInfo | null;
  // Owner only; the menu item is hidden without it.
  onReset?: () => void;
  onLeaveRoom: () => void;
  // Hidden without it (local mode has no history).
  onOpenActivity?: () => void;
  onDownloadPdf: (kind: ReportKind) => Promise<void>;
}

// Shown while the trip loads and for legacy rooms saved without trip metadata
const FALLBACK = {
  name: "Tu viaje",
  subtitle: "Viaje en grupo",
};

const DOT: Record<SyncState, string> = {
  idle: "bg-primary",
  saving: "bg-amber-400 animate-pulse",
  saved: "bg-primary",
  error: "bg-destructive",
};

const ITEM = "flex cursor-pointer select-none items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] text-foreground outline-none data-highlighted:bg-secondary";

export default function AppHeader({ roomCode, connected, saveState, lastSavedAt, trip, onReset, onLeaveRoom, onOpenActivity, onDownloadPdf }: AppHeaderProps) {
  const local = roomCode === "LOCAL";
  const now = useNow();
  const ago = connected ? savedAgo(saveState, lastSavedAt, now.getTime()) : null;
  const sync = connected
    ? { label: syncLabel(saveState), dot: DOT[saveState] }
    : { label: "Conectando…", dot: "bg-muted-foreground animate-pulse" };
  const [copied, setCopied] = useState(false);

  function download(kind: ReportKind) {
    onDownloadPdf(kind).catch(() => alert("No se pudo generar el PDF. Intenta de nuevo con internet."));
  }

  function copyCode() {
    navigator.clipboard?.writeText(roomCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <header className="mb-4 flex items-center justify-between gap-3 md:mb-5">
      <div className="min-w-0">
        <h1 className="truncate text-xl font-semibold tracking-tight text-foreground md:text-2xl">{trip?.name ?? FALLBACK.name}</h1>
        <p className="mt-0.5 truncate text-[13px] text-muted-foreground">
          {trip ? (
            <>
              {fmtTripDates(trip.startDate, trip.endDate)}
              {trip.destination && <> · {trip.destination}</>}
            </>
          ) : FALLBACK.subtitle}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 md:gap-2.5">
        {!local && (
          <span
            role="status"
            aria-live="polite"
            className={cn("flex items-center gap-1.5 text-xs text-muted-foreground", saveState === "error" && "text-destructive")}
            title={ago ? `${sync.label} · ${ago}` : sync.label}
          >
            <span className={cn("h-2 w-2 shrink-0 rounded-full", sync.dot)} />
            <span className={cn("whitespace-nowrap", saveState === "idle" && "hidden md:inline")}>
              {sync.label}
              {ago && <span className="hidden md:inline"> · {ago}</span>}
            </span>
          </span>
        )}

        <Menu.Root>
          <Menu.Trigger
            aria-label="Opciones del viaje"
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground data-popup-open:bg-secondary"
          >
            <Ellipsis className="size-5" />
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner sideOffset={6} align="end" className="z-50 outline-none">
              <Menu.Popup className="min-w-52 origin-[var(--transform-origin)] rounded-xl border border-border bg-popover p-1 shadow-[0_10px_30px_rgba(0,0,0,.12)] outline-none transition-[scale,opacity] duration-100 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
                {!local && (
                  <Menu.Item className={ITEM} onClick={copyCode} closeOnClick={false}>
                    <Copy className="size-4 text-muted-foreground" />
                    <span className="flex-1">{copied ? "¡Código copiado!" : "Copiar código"}</span>
                    <span className="font-mono text-xs font-semibold tracking-wider text-muted-foreground">{roomCode}</span>
                  </Menu.Item>
                )}
                {onOpenActivity && (
                  <Menu.Item className={ITEM} onClick={onOpenActivity}>
                    <History className="size-4 text-muted-foreground" />
                    Actividad
                  </Menu.Item>
                )}
                <Menu.Item className={ITEM} onClick={() => download("migration")}>
                  <FileDown className="size-4 text-muted-foreground" />
                  PDF para migración
                </Menu.Item>
                <Menu.Item className={ITEM} onClick={() => download("full")}>
                  <FileDown className="size-4 text-muted-foreground" />
                  PDF del itinerario completo
                </Menu.Item>
                {onReset && (
                  <>
                    <Menu.Separator className="mx-1 my-1 h-px bg-border" />
                    <Menu.Item className={ITEM} onClick={onReset}>
                      <RotateCcw className="size-4 text-muted-foreground" />
                      Restablecer itinerario
                    </Menu.Item>
                  </>
                )}
                <Menu.Separator className="mx-1 my-1 h-px bg-border" />
                <Menu.Item className={ITEM} onClick={onLeaveRoom}>
                  <LogOut className="size-4 text-muted-foreground" />
                  {local ? "Salir del modo local" : "Volver a mis viajes"}
                </Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>

        <AuthButton />
      </div>
    </header>
  );
}
