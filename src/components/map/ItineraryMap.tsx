"use client";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { CloudDownload, Loader2, MapPin } from "lucide-react";
import dynamic from "next/dynamic";
import DayStrip from "@/components/map/DayStrip";
import NearbyList from "@/components/map/NearbyList";
import PlaceCarousel from "@/components/map/PlaceCarousel";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { canStoreMap, needsRefresh, offlineMapState, storeMapOffline } from "@/lib/mapOffline";
import { eventKey, inTripRegion, mapStops, missingPhotos, staleEvents, stopOrder, type LngLat } from "@/utils/tripGeo";
import type { useTripGeo } from "@/hooks/useTripGeo";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Day, EventPlace, RoomPayload } from "@/types";

// The map library only runs in the browser. Offline, its code may be missing
// from the device (never stored since the last deploy).
const TripMap = dynamic(() => import("@/components/map/TripMap").catch(() => MapUnavailable), { ssr: false });

function MapUnavailable({ className }: { className: string }) {
  return (
    <div className={cn("relative min-h-[320px] overflow-hidden", className)}>
      <div className="flex h-full items-center justify-center bg-secondary p-6 text-center text-[13px] text-muted-foreground">
        El mapa no está guardado en este dispositivo. Ábrelo una vez con internet.
      </div>
    </div>
  );
}

interface ItineraryMapProps {
  geo: ReturnType<typeof useTripGeo>;
  days: Day[];
  todayIdx?: number;
  roomCode: string;
  accessToken: string | undefined;
  localMode: boolean;
  currentPayload: () => RoomPayload;
  save: (payload: RoomPayload, opts?: { force?: boolean }) => Promise<boolean>;
  onOpenEvent: (eventId: string) => void;
}

type Status = { kind: "idle" } | { kind: "locating"; count: number } | { kind: "error"; message: string };
type Storing = { done: number; total: number } | "ready" | null;

// What this session already asked to locate (activity id + its text), and the
// rooms whose photos were looked up: each is asked once, edits ask again.
const tried = new Set<string>();
const photosTried = new Set<string>();
const LOCATE_DELAY = 2500;   // ms after the last itinerary change

// Itinerary as a map: a pin per place, filtered by day, the user's position
// and what's near it. Activities are located the first time (and when they
// change), and the map of the trip's region is kept for use without internet.
export default function ItineraryMap({ geo, days, todayIdx, roomCode, accessToken, localMode, currentPayload, save, onOpenEvent }: ItineraryMapProps) {
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

  const allStops = useMemo(() => mapStops(days, geo.eventPlaces).filter(inTripRegion), [days, geo.eventPlaces]);
  const stops = dayIdx == null ? allStops : allStops.filter((s) => s.visits.some((v) => v.dayIdx === dayIdx));
  const stale = staleEvents(days, geo.eventPlaces);
  const order = useMemo(() => stopOrder(allStops, dayIdx), [allStops, dayIdx]);

  // The server reads the saved room (save first); the local demo room sends it.
  async function locate() {
    setStatus({ kind: "locating", count: stale.length });
    try {
      const payload = currentPayload();
      if (!localMode && !(await save(payload, { force: true }))) throw new Error("No se pudo guardar el viaje. Intenta de nuevo.");
      const res = await apiFetch(`/api/rooms/${roomCode}/places`, accessToken, {
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

  // The map follows the itinerary: activities added or edited (here or by
  // another member) are located a moment after the changes stop. Places still
  // without a photo search get one, once per session.
  const untried = stale.filter((ev) => !tried.has(`${roomCode}|${ev.id}|${eventKey(ev)}`));
  const untriedKey = untried.map((ev) => ev.id).join(",");
  const noPhotos = missingPhotos(geo.eventPlaces) && !photosTried.has(roomCode);
  useEffect(() => {
    if ((!untriedKey && !noPhotos) || status.kind === "locating" || !navigator.onLine) return;
    const timer = setTimeout(() => {
      for (const ev of untried) tried.add(`${roomCode}|${ev.id}|${eventKey(ev)}`);
      photosTried.add(roomCode);
      void locate();
    }, LOCATE_DELAY);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by what's still to locate
  }, [roomCode, untriedKey, noPhotos, status.kind]);

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

  // Phone: the map fills the screen down to the tab bar, edge to edge.
  const mobile = useIsMobile();
  const fillRef = useRef<HTMLDivElement>(null);
  const [fill, setFill] = useState<number | null>(null);
  useLayoutEffect(() => {
    if (!mobile) return;
    const update = () => {
      const el = fillRef.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY;
      const bar = document.querySelector("nav")?.getBoundingClientRect().height ?? 0;
      setFill(Math.max(320, window.innerHeight - top - bar));
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [mobile]);

  const focusStop = (id: string) => setFocus((f) => ({ id, n: (f?.n ?? 0) + 1 }));
  const map = (className: string, bottomInset: number) => (
    <TripMap
      className={className}
      touch={mobile}
      bottomInset={bottomInset}
      days={days}
      stops={stops}
      order={order}
      dayIdx={dayIdx}
      fitRequest={fitRequest}
      focus={focus}
      onPosition={setPosition}
      onOpenEvent={onOpenEvent}
    />
  );

  const locating = status.kind === "locating" && (
    <span className="flex items-center gap-1.5"><Loader2 className="size-3.5 animate-spin" />
      {status.count > 0 ? `Ubicando ${status.count} actividades en el mapa…` : "Buscando fotos de los lugares…"}
    </span>
  );
  const failed = status.kind === "error" && (
    <span className="text-destructive">
      {status.message} · <button onClick={locate} className="cursor-pointer underline underline-offset-2">reintentar</button>
    </span>
  );
  const pending = status.kind === "idle" && stale.length > 0 && (
    <button onClick={locate} className="flex cursor-pointer items-center gap-1.5 underline-offset-2 hover:underline">
      <MapPin className="size-3.5" />Ubicar {stale.length} {stale.length === 1 ? "actividad nueva" : "actividades nuevas"}
    </button>
  );
  const saving = storing && storing !== "ready" && (
    <span className="flex items-center gap-1.5">
      <CloudDownload className="size-3.5" />Guardando mapa sin conexión… {Math.round((storing.done / storing.total) * 100)}%
    </span>
  );

  if (mobile) {
    const notice = locating || failed || pending || saving;
    return (
      <div className="flex flex-col gap-2">
        <DayStrip days={days} selected={dayIdx} onSelect={pickDay} />
        <div ref={fillRef} className="relative -mx-4" style={{ height: fill ?? "60dvh" }}>
          {map("h-full", 112)}
          {notice && (
            <div role="status" className="absolute left-1/2 top-3 z-10 max-w-[80%] -translate-x-1/2 rounded-full bg-card/95 px-3 py-1.5 text-xs text-secondary-foreground shadow-md ring-1 ring-border backdrop-blur">
              {notice}
            </div>
          )}
          <div className="absolute inset-x-0 bottom-3 z-10">
            <PlaceCarousel stops={stops} order={order} days={days} dayIdx={dayIdx} position={position} onFocus={focusStop} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <DayStrip days={days} selected={dayIdx} onSelect={pickDay} />
      {map("h-[68dvh] rounded-2xl ring-1 ring-border", 0)}
      <div className="flex flex-col items-start gap-1 text-xs text-muted-foreground" aria-live="polite">
        {locating}
        {failed}
        {pending}
        {saving}
        {storing === "ready" && <span className="flex items-center gap-1.5"><CloudDownload className="size-3.5" />Mapa de Orlando, Miami y el crucero guardado para usar sin internet</span>}
        <span>Tip: pega un link de Google Maps en la nota de una actividad para fijar su ubicación exacta.</span>
      </div>
      {position && <NearbyList position={position} stops={allStops} days={days} onFocus={focusStop} />}
    </div>
  );
}
