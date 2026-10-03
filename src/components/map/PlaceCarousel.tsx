"use client";
import { Navigation } from "lucide-react";
import { dayColor } from "@/constants/mapColors";
import { googleMapsDirectionsUrl } from "@/utils/googleMaps";
import { fmtHour } from "@/utils/time";
import { distanceKm, fmtDistance, type LngLat, type MapStop } from "@/utils/tripGeo";
import type { Day } from "@/types";

const NEAREST = 8;

// Phone: swipeable place cards over the bottom of the map, like Maps apps.
// A selected day lists its places in visit order; otherwise the ones nearest
// to the user. Tapping a card flies the map to its pin.
export default function PlaceCarousel({ stops, order, days, dayIdx, position, onFocus }: {
  stops: MapStop[];
  order: Map<string, number>;
  days: Day[];
  dayIdx: number | null;
  position: LngLat | null;
  onFocus: (stopId: string) => void;
}) {
  const items = dayIdx != null
    ? stops
      .flatMap((s) => s.visits.filter((v) => v.dayIdx === dayIdx).map((v) => ({ s, v })))
      .sort((a, b) => a.v.start - b.v.start)
      .filter(({ s }, i, all) => all.findIndex((x) => x.s.id === s.id) === i)
      .map(({ s, v }) => ({ s, v, detail: `${fmtHour(v.start)} · ${v.title}` }))
    : position
      ? stops
        .map((s) => ({ s, km: distanceKm(position, s) }))
        .sort((a, b) => a.km - b.km)
        .slice(0, NEAREST)
        .map(({ s, km }) => ({ s, v: s.visits[0], detail: `${fmtDistance(km)} · ${days[s.visits[0].dayIdx]?.label ?? ""}` }))
      : [];
  if (items.length === 0) return null;

  return (
    // A new list (another day, or nearby) starts from its first card.
    <ul
      key={dayIdx ?? "near"}
      aria-label={dayIdx != null ? "Lugares del día" : "Cerca de ti"}
      className="flex snap-x snap-mandatory scroll-px-3 gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {items.map(({ s, v, detail }) => (
        <li key={s.id} className="flex w-[78%] max-w-[300px] shrink-0 snap-start items-center gap-2.5 rounded-2xl bg-card/95 p-2 shadow-[0_4px_16px_rgba(0,0,0,.14)] ring-1 ring-border backdrop-blur">
          <button onClick={() => onFocus(s.id)} className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 text-left">
            <span className="relative shrink-0">
              {s.photo
                // eslint-disable-next-line @next/next/no-img-element -- remote Wikipedia thumbnails, cached by the service worker
                ? <img src={s.photo} crossOrigin="anonymous" alt="" className="size-12 rounded-xl bg-secondary object-cover" onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />
                : <span className="block size-12 rounded-xl" style={{ background: dayColor(v.dayIdx) }} />}
              <span
                className={s.photo
                  ? "absolute -left-1 -top-1 flex size-5 items-center justify-center rounded-full border-2 border-white text-[10px] font-bold text-white"
                  : "absolute inset-0 flex items-center justify-center text-sm font-bold text-white"}
                style={s.photo ? { background: dayColor(v.dayIdx) } : undefined}
              >
                {order.get(s.id)}
              </span>
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[14px] font-semibold">{s.name}</span>
              <span className="block truncate text-xs text-muted-foreground">{detail}</span>
            </span>
          </button>
          <a
            href={googleMapsDirectionsUrl(s)}
            target="_blank"
            rel="noreferrer"
            aria-label={`Cómo llegar a ${s.name}`}
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
          >
            <Navigation className="size-[18px]" />
          </a>
        </li>
      ))}
    </ul>
  );
}
