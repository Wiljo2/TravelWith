"use client";
import { useEffect, useRef, useState } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import type { GeolocateControl, Map as MapLibre, Marker } from "maplibre-gl";
import { version as maplibreVersion } from "maplibre-gl/package.json";
import { dayColor } from "@/constants/mapColors";
import { MAP_STYLE } from "@/lib/mapOffline";
import { googleMapsDirectionsUrl, googleMapsPlaceUrl } from "@/utils/googleMaps";
import { boundsOf, TRIP_REGION, type LngLat, type MapStop } from "@/utils/tripGeo";
import { fmtHour } from "@/utils/time";
import type { Day } from "@/types";

interface TripMapProps {
  days: Day[];
  stops: MapStop[];            // pins to show (already filtered by day)
  dayIdx: number | null;       // selected day: its route is drawn
  fitRequest: number;          // bumped when the user picks a day (or the whole trip) again
  focus: { id: string; n: number } | null;  // fly to this pin (n re-triggers the same one)
  onPosition: (p: LngLat | null) => void;
  onOpenEvent: (eventId: string) => void;
}

const PIN = 36;          // pin circle, px
const NAMES_ZOOM = 11;   // place names show from about city level in

const inRegion = (p: LngLat) => p.lng >= TRIP_REGION.west && p.lng <= TRIP_REGION.east && p.lat >= TRIP_REGION.south && p.lat <= TRIP_REGION.north;

// MapLibre map (OpenFreeMap tiles) with the trip's pins, the selected day's
// route and the user's live position. Loaded on demand: it's a large library.
export default function TripMap({ days, stops, dayIdx, fitRequest, focus, onPosition, onOpenEvent }: TripMapProps) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibre | null>(null);
  const lib = useRef<typeof import("maplibre-gl") | null>(null);
  const markers = useRef(new Map<string, Marker>());
  const located = useRef(false);
  const lastFit = useRef("");
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  // Latest callbacks, so the map's listeners never go stale.
  const cb = useRef({ onPosition, onOpenEvent });
  cb.current = { onPosition, onOpenEvent };

  useEffect(() => {
    let cancelled = false;
    let instance: MapLibre | null = null;
    (async () => {
      const maplibre = await import("maplibre-gl");
      if (cancelled || !box.current) return;
      lib.current = maplibre;
      // Published by scripts/copy-maplibre-worker.mjs (the bundle can't serve it).
      maplibre.setWorkerUrl(`/vendor/maplibre-${maplibreVersion}/maplibre-gl-worker.mjs`);
      instance = new maplibre.Map({
        container: box.current,
        style: MAP_STYLE,
        bounds: [[TRIP_REGION.west, TRIP_REGION.south], [TRIP_REGION.east, TRIP_REGION.north]],
        attributionControl: { compact: true },
      });
      map.current = instance;
      instance.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-right");
      const geo: GeolocateControl = new maplibre.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true,
        showAccuracyCircle: true,
      });
      instance.addControl(geo, "top-right");
      geo.on("geolocate", (e) => {
        const p = { lat: e.coords.latitude, lng: e.coords.longitude };
        cb.current.onPosition(p);
        // First fix inside the trip's region: show what's around.
        if (!located.current && inRegion(p)) {
          located.current = true;
          instance?.flyTo({ center: [p.lng, p.lat], zoom: Math.max(instance.getZoom(), 13) });
        }
      });
      geo.on("trackuserlocationend", () => cb.current.onPosition(null));
      instance.on("error", (e) => { if (!instance?.isStyleLoaded() && /style/i.test(String(e.error?.message))) setFailed(true); });
      const showNames = () => { box.current?.setAttribute("data-names", instance!.getZoom() >= NAMES_ZOOM ? "on" : "off"); };
      instance.on("zoomend", showNames);
      instance.on("load", () => {
        showNames();
        if (cancelled) return;
        instance!.addSource("route", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        instance!.addLayer({
          id: "route", type: "line", source: "route",
          paint: { "line-color": ["get", "color"], "line-width": 3, "line-dasharray": [2, 1.5], "line-opacity": 0.8 },
          layout: { "line-cap": "round", "line-join": "round" },
        });
        setReady(true);
        // Already allowed: follow the user right away (no prompt).
        navigator.permissions?.query({ name: "geolocation" })
          .then((s) => { if (s.state === "granted") geo.trigger(); })
          .catch(() => undefined);
      });
    })().catch(() => setFailed(true));
    return () => {
      cancelled = true;
      instance?.remove();
      map.current = null;
      markers.current.clear();
    };
  }, []);

  // Pins: one per spot, numbered and colored by the first day it's visited.
  useEffect(() => {
    const m = map.current;
    const maplibre = lib.current;
    if (!ready || !m || !maplibre) return;
    for (const mk of markers.current.values()) mk.remove();
    markers.current.clear();
    for (const stop of stops) {
      // Anchored at the top, nudged up by half the circle: the circle's center
      // sits on the spot and the name hangs below it.
      const marker = new maplibre.Marker({ element: pinElement(stop), anchor: "top", offset: [0, -PIN / 2] })
        .setLngLat([stop.lng, stop.lat])
        .setPopup(new maplibre.Popup({ offset: PIN / 2 + 2, maxWidth: "min(240px, 70vw)" }).setDOMContent(popupContent(stop, days, (id) => cb.current.onOpenEvent(id))))
        .addTo(m);
      markers.current.set(stop.id, marker);
    }
  }, [ready, stops, days]);

  // The selected day's route, in visit order. The camera frames the selection
  // when the user picks it; pins arriving later don't pull it away from the
  // user's surroundings once they're known.
  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    const path = dayIdx == null ? [] : stops
      .flatMap((s) => s.visits.filter((v) => v.dayIdx === dayIdx).map((v) => ({ s, start: v.start })))
      .sort((a, b) => a.start - b.start)
      .map(({ s }) => [s.lng, s.lat])
      .filter((c, i, all) => i === 0 || c[0] !== all[i - 1][0] || c[1] !== all[i - 1][1]);
    const source = m.getSource("route") as import("maplibre-gl").GeoJSONSource | undefined;
    source?.setData({
      type: "FeatureCollection",
      features: path.length > 1 ? [{ type: "Feature", properties: { color: dayColor(dayIdx ?? 0) }, geometry: { type: "LineString", coordinates: path } }] : [],
    });
    const request = `${dayIdx}|${fitRequest}`;
    const picked = request !== lastFit.current;
    lastFit.current = request;
    if (!picked && located.current) return;
    const local = dayIdx == null ? stops.filter(inRegion) : stops;
    const b = boundsOf(local);
    if (b) m.fitBounds([[b.west, b.south], [b.east, b.north]], { padding: 56, maxZoom: 15, duration: 600 });
  }, [ready, stops, dayIdx, fitRequest]);

  useEffect(() => {
    const m = map.current;
    const stop = focus && stops.find((s) => s.id === focus.id);
    if (!ready || !m || !stop) return;
    m.flyTo({ center: [stop.lng, stop.lat], zoom: Math.max(m.getZoom(), 15) });
    const marker = markers.current.get(stop.id);
    if (marker && !marker.getPopup()?.isOpen()) marker.togglePopup();
  }, [ready, focus, stops]);

  return (
    <div className="relative h-[60dvh] min-h-[360px] overflow-hidden rounded-2xl ring-1 ring-border md:h-[68dvh]">
      {/* MapLibre makes its container position: relative, so size it directly. */}
      <div ref={box} className="group/map h-full w-full" />
      {(!ready || failed) && (
        <div className="absolute inset-0 flex items-center justify-center bg-secondary p-6 text-center text-[13px] text-muted-foreground">
          {failed ? "No se pudo cargar el mapa. La primera vez necesita internet." : "Cargando mapa…"}
        </div>
      )}
    </div>
  );
}

// A pin: the place's photo in a circle ringed with the day's color (or the
// day's number when there's no photo), the day in a corner badge, and the
// place's name below. Built as DOM: names are user text, never HTML.
function pinElement(stop: MapStop): HTMLElement {
  const first = stop.visits[0].dayIdx;
  const color = dayColor(first);
  const el = document.createElement("button");
  el.type = "button";
  el.setAttribute("aria-label", stop.name);
  el.className = "flex cursor-pointer flex-col items-center";

  const circle = document.createElement("span");
  circle.className = "relative flex items-center justify-center rounded-full border-[3px] bg-white text-[12px] font-bold text-white shadow-md";
  Object.assign(circle.style, { width: `${PIN}px`, height: `${PIN}px`, borderColor: color, background: color });
  const number = () => { circle.textContent = String(first + 1); };
  if (stop.photo) {
    const img = document.createElement("img");
    img.crossOrigin = "anonymous";   // the same cached copy as the popup's
    img.src = stop.photo;
    img.alt = "";
    img.className = "size-full rounded-full object-cover";
    img.onerror = () => { img.remove(); badge.remove(); number(); };
    circle.append(img);
  } else {
    number();
  }
  const badge = document.createElement("span");
  badge.className = "absolute -right-1.5 -top-1.5 flex size-[18px] items-center justify-center rounded-full border-2 border-white text-[10px] font-bold text-white";
  badge.style.background = color;
  badge.textContent = String(first + 1);
  if (stop.photo) circle.append(badge);

  const name = document.createElement("span");
  name.className = "mt-0.5 hidden max-w-[120px] truncate rounded-md bg-card/95 px-1.5 py-px text-[10px] font-semibold text-foreground shadow-sm group-data-[names=on]/map:block";
  name.textContent = stop.name;

  el.append(circle, name);
  return el;
}

// Popup body, built as DOM (titles are user text: never as HTML).
function popupContent(stop: MapStop, days: Day[], onOpen: (eventId: string) => void): HTMLElement {
  const root = document.createElement("div");
  root.className = "flex max-h-72 flex-col gap-1.5 overflow-y-auto text-[13px] text-foreground";
  if (stop.photo) {
    const img = document.createElement("img");
    img.crossOrigin = "anonymous";   // a CORS image can be kept for offline use
    img.src = stop.photo;
    img.alt = "";
    img.loading = "lazy";
    img.className = "mb-0.5 h-28 w-full shrink-0 rounded-lg bg-secondary object-cover";
    img.onerror = () => img.remove();
    root.append(img);
  }
  const title = document.createElement("strong");
  title.className = "text-sm";
  title.textContent = stop.name;
  root.append(title);
  for (const v of stop.visits) {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "flex cursor-pointer items-baseline gap-1.5 rounded-md text-left hover:underline";
    const dot = document.createElement("span");
    dot.className = "size-2 shrink-0 rounded-full";
    dot.style.background = dayColor(v.dayIdx);
    const text = document.createElement("span");
    text.textContent = `${days[v.dayIdx]?.label.split("·")[0].trim() ?? ""} ${days[v.dayIdx]?.label.split("·")[1]?.trim() ?? ""} · ${fmtHour(v.start)} — ${v.title}`;
    row.append(dot, text);
    row.onclick = () => onOpen(v.eventId);
    root.append(row);
  }
  const links = document.createElement("div");
  links.className = "mt-1 flex gap-3 text-xs font-semibold";
  for (const [label, href] of [["Abrir en Google Maps", googleMapsPlaceUrl(stop)], ["Cómo llegar", googleMapsDirectionsUrl(stop)]]) {
    const a = document.createElement("a");
    a.href = href;
    a.target = "_blank";
    a.rel = "noreferrer";
    a.className = "text-emerald-700 hover:underline";
    a.textContent = label;
    links.append(a);
  }
  root.append(links);
  if (stop.photo && stop.photoPage) {
    const credit = document.createElement("a");
    credit.href = stop.photoPage;
    credit.target = "_blank";
    credit.rel = "noreferrer";
    credit.className = "text-[11px] text-muted-foreground hover:underline";
    credit.textContent = "Foto: Wikipedia";
    root.append(credit);
  }
  return root;
}
