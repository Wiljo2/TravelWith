"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { CloudDownload, Loader2, MapPin } from "lucide-react";
import dynamic from "next/dynamic";
import NearbyList from "@/components/map/NearbyList";
import { dayColor } from "@/constants/mapColors";
import { canStoreMap, needsRefresh, offlineMapState, storeMapOffline } from "@/lib/mapOffline";
import { mapStops, missingPhotos, staleEvents, type LngLat } from "@/utils/tripGeo";
import { cn } from "@/lib/utils";
import type { useTripGeo } from "@/hooks/useTripGeo";
import type { RoomPayload } from "@/hooks/useRoom";
import type { Day, EventPlace } from "@/types";

// The map library only runs in the browser.
const TripMap = dynamic(() => import("@/components/map/TripMap"), { ssr: false });

interface ItineraryMapProps {
  geo: ReturnType<typeof useTripGeo>;
  days: Day[];
  todayIdx?: number;
  roomCode: string;
  localMode: boolean;
  currentPayload: () => RoomPayload;
  save: (payload: RoomPayload, opts?: { force?: boolean }) => Promise<boolean>;
  onOpenEvent: (eventId: string) => void;
}

type Status = { kind: "idle" } | { kind: "locating"; count: number } | { kind: "error"; message: string };
type Storing = { done: number; total: number } | "ready" | null;

// Rooms already located in this session: opening the map again doesn't re-ask.
const attempted = new Set<string>();

// Itinerary as a map: a pin per place, filtered by day, the user's position
// and what's near it. Activities are located the first time (and when they
// change), and the map of the trip's region is kept for use without internet.
export default function ItineraryMap({ geo, days, todayIdx, roomCode, localMode, currentPayload, save, onOpenEvent }: ItineraryMapProps) {
  const [dayIdx, setDayIdx] = useState<number | null>(todayIdx ?? null);
  const [position, setPosition] = useState<LngLat | null>(null);
  const [focus, setFocus] = useState<{ id: string; n: number } | null>(null);
  const [fitRequest, setFitRequest] = useState(0);
  function pickDay(idx: number | null) {
    setDayIdx(idx);
    setFocus(null);
    setFitRequest((n) => n + 1);
  }
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [storing, setStoring] = useState<Storing>(() => (offlineMapState() ? "ready" : null));
  const storingRun = useRef(false);

  const allStops = useMemo(() => mapStops(days, geo.eventPlaces), [days, geo.eventPlaces]);
  const stops = dayIdx == null ? allStops : allStops.filter((s) => s.visits.some((v) => v.dayIdx === dayIdx));
  const stale = staleEvents(days, geo.eventPlaces);

  // The server reads the saved room (save first); the local demo room sends it.
  async function locate() {
    setStatus({ kind: "locating", count: stale.length });
    try {
      const payload = currentPayload();
      if (!localMode && !(await save(payload, { force: true }))) throw new Error("No se pudo guardar el viaje. Intenta de nuevo.");
      const res = await fetch(`/api/rooms/${roomCode}/places`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: localMode ? payload : undefined }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.places) throw new Error(data?.error ?? "No se pudieron ubicar los lugares");
      geo.merge(data.places as Record<string, EventPlace>, days);
      setStatus({ kind: "idle" });
    } catch (e) {
      setStatus({ kind: "error", message: e instanceof Error ? e.message : "No se pudieron ubicar los lugares" });
    }
  }

  // New or edited activities, or places still without a photo search.
  const noPhotos = missingPhotos(geo.eventPlaces);
  useEffect(() => {
    if ((stale.length === 0 && !noPhotos) || attempted.has(roomCode) || !navigator.onLine) return;
    attempted.add(roomCode);
    void locate();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- once per room and session
  }, [roomCode, stale.length, noPhotos]);

  // Keep the region and every pin's surroundings on the device (production only).
  useEffect(() => {
    const points = allStops.map(({ lat, lng }) => ({ lat, lng }));
    const photos = allStops.flatMap((s) => (s.photo ? [s.photo] : []));
    if (storingRun.current || points.length === 0 || !navigator.onLine || !canStoreMap()) return;
    if (!needsRefresh(offlineMapState(), points, photos)) return;
    storingRun.current = true;
    setStoring({ done: 0, total: 1 });
    storeMapOffline(points, photos, (done, total) => setStoring({ done, total }))
      .then(() => setStoring("ready"))
      .catch(() => setStoring(null))
      .finally(() => { storingRun.current = false; });
  }, [allStops]);

  return (
    <div className="flex flex-col gap-3">
      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0">
        <DayChip label="Todo el viaje" active={dayIdx == null} onClick={() => pickDay(null)} />
        {days.map((d, i) => (
          <DayChip key={d.id} label={d.label} color={dayColor(i)} active={dayIdx === i} onClick={() => pickDay(i)} />
        ))}
      </div>

      <TripMap
        days={days}
        stops={stops}
        dayIdx={dayIdx}
        fitRequest={fitRequest}
        focus={focus}
        onPosition={setPosition}
        onOpenEvent={onOpenEvent}
      />

      <div className="flex flex-col gap-1 text-xs text-muted-foreground" aria-live="polite">
        {status.kind === "locating" && (
          <span className="flex items-center gap-1.5"><Loader2 className="size-3.5 animate-spin" />
            {status.count > 0 ? `Ubicando ${status.count} actividades en el mapa… (unos segundos)` : "Buscando fotos de los lugares…"}
          </span>
        )}
        {status.kind === "error" && (
          <span className="text-destructive">
            {status.message} · <button onClick={locate} className="cursor-pointer underline underline-offset-2">reintentar</button>
          </span>
        )}
        {status.kind === "idle" && stale.length > 0 && (
          <button onClick={locate} className="flex cursor-pointer items-center gap-1.5 self-start underline-offset-2 hover:underline">
            <MapPin className="size-3.5" />Ubicar {stale.length} {stale.length === 1 ? "actividad nueva" : "actividades nuevas"}
          </button>
        )}
        {storing && storing !== "ready" && (
          <span className="flex items-center gap-1.5">
            <CloudDownload className="size-3.5" />Guardando el mapa del viaje para usar sin internet… {Math.round((storing.done / storing.total) * 100)}%
          </span>
        )}
        {storing === "ready" && <span className="flex items-center gap-1.5"><CloudDownload className="size-3.5" />Mapa de Orlando, Miami y el crucero guardado para usar sin internet</span>}
        <span>Tip: pega un link de Google Maps en la nota de una actividad para fijar su ubicación exacta.</span>
      </div>

      {position && <NearbyList position={position} stops={allStops} days={days} onFocus={(id) => setFocus((f) => ({ id, n: (f?.n ?? 0) + 1 }))} />}
    </div>
  );
}

function DayChip({ label, color, active, onClick }: { label: string; color?: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium ring-1 transition-colors",
        active ? "bg-foreground text-background ring-foreground" : "bg-card text-secondary-foreground ring-border hover:text-foreground",
      )}
    >
      {color && <span className="size-2 rounded-full" style={{ background: color }} />}
      {label}
    </button>
  );
}
