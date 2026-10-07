import { Navigation } from "lucide-react";
import { PANEL } from "@/components/home/shared";
import { dayColor } from "@/constants/mapColors";
import { googleMapsDirectionsUrl } from "@/utils/googleMaps";
import { distanceKm, fmtDistance, type LngLat, type MapStop } from "@/utils/tripGeo";
import type { Day } from "@/types";

const SHOWN = 5;

// The trip's places closest to where the user is right now.
export default function NearbyList({ position, stops, days, onFocus }: {
  position: LngLat;
  stops: MapStop[];
  days: Day[];
  onFocus: (stopId: string) => void;
}) {
  const nearest = stops
    .map((s) => ({ s, km: distanceKm(position, s) }))
    .sort((a, b) => a.km - b.km)
    .slice(0, SHOWN);
  if (nearest.length === 0) return null;

  return (
    <section className={PANEL}>
      <h2 className="text-[15px] font-semibold">Cerca de ti</h2>
      <ul className="mt-2 divide-y divide-border">
        {nearest.map(({ s, km }) => {
          const v = s.visits[0];
          return (
            <li key={s.id} className="flex items-center gap-3 py-2">
              <button onClick={() => onFocus(s.id)} className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 text-left">
                {s.photo
                  // eslint-disable-next-line @next/next/no-img-element -- remote search thumbnails, not optimizable
                  ? <img src={s.photo} crossOrigin="anonymous" alt="" className="size-10 shrink-0 rounded-lg bg-secondary object-cover" style={{ boxShadow: `inset 0 0 0 2px ${dayColor(v.dayIdx)}` }} onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />
                  : <span className="size-2.5 shrink-0 rounded-full" style={{ background: dayColor(v.dayIdx) }} />}
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-medium">{s.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {days[v.dayIdx]?.label} · {v.title}{s.visits.length > 1 ? ` · +${s.visits.length - 1}` : ""}
                  </span>
                </span>
              </button>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{fmtDistance(km)}</span>
              <a
                href={googleMapsDirectionsUrl(s)}
                target="_blank"
                rel="noreferrer"
                aria-label={`Cómo llegar a ${s.name}`}
                className="flex size-8 shrink-0 items-center justify-center rounded-full text-emerald-700 hover:bg-accent"
              >
                <Navigation className="size-4" />
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
