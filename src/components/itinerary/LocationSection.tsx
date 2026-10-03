"use client";
import { useState } from "react";
import { Check, ExternalLink, MapPin, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { findGoogleMapsLink, googleMapsPlaceUrl } from "@/utils/googleMaps";
import type { CalendarEvent, EventPlace } from "@/types";

const SOURCE: Record<NonNullable<EventPlace["source"]>, string> = {
  link: "desde tu link",
  geocoder: "ubicada automáticamente",
  claude: "ubicada automáticamente (aproximada)",
};

// Where an activity happens on the trip map, and its Google Maps link: pasting
// one pins the exact spot (the map picks it up a few seconds later). Editable
// with the dirty + ✓/✕ pattern.
export default function LocationSection({ ev, place, onSetLink }: {
  ev: CalendarEvent;
  place?: EventPlace;
  onSetLink: (url: string | undefined) => void;
}) {
  const [draft, setDraft] = useState(ev.mapsUrl ?? "");
  const [error, setError] = useState(false);
  const dirty = draft.trim() !== (ev.mapsUrl ?? "");

  function commit() {
    const text = draft.trim();
    if (!text) { onSetLink(undefined); setError(false); return; }
    const link = findGoogleMapsLink(text);
    if (!link) { setError(true); return; }
    setDraft(link);
    setError(false);
    onSetLink(link);
  }
  function cancel() { setDraft(ev.mapsUrl ?? ""); setError(false); }

  const located = place?.kind === "place" && place.lat != null && place.lng != null;
  return (
    <section className="mt-4 rounded-xl border border-border p-3">
      <h3 className="flex items-center gap-1.5 text-[13px] font-semibold"><MapPin className="size-4 text-emerald-700" />Ubicación</h3>
      <p className="mt-1 text-[13px] text-secondary-foreground">
        {located ? (
          <>
            {place.name ?? ev.title}
            {place.source && <span className="text-muted-foreground"> · {SOURCE[place.source]}</span>}
          </>
        ) : place?.kind === "ship" ? "A bordo del crucero"
          : place?.kind === "none" ? "Sin un lugar fijo"
            : "Aún sin ubicar: se ubica al abrir el Mapa"}
      </p>
      {located && (
        <a
          href={findGoogleMapsLink(ev.mapsUrl ?? "") ?? googleMapsPlaceUrl({ lat: place.lat!, lng: place.lng!, query: place.query, name: place.name })}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex items-center gap-1 rounded-full border border-emerald-700/40 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-accent"
        >
          <ExternalLink className="size-3.5" /> Abrir en Google Maps
        </a>
      )}

      <label className="mt-3 block text-[11px] font-semibold tracking-[.04em] text-muted-foreground" htmlFor={`maps-${ev.id}`}>
        LINK DE GOOGLE MAPS
      </label>
      <div className="mt-1 flex items-center gap-1.5">
        <Input
          id={`maps-${ev.id}`}
          value={draft}
          onChange={(e) => { setDraft(e.target.value); setError(false); }}
          onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") cancel(); }}
          placeholder="https://maps.app.goo.gl/…"
          inputMode="url"
          className="h-9 bg-secondary text-xs"
        />
        {dirty && (
          <>
            <button onClick={commit} aria-label="Guardar link" className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Check className="size-4" />
            </button>
            <button onClick={cancel} aria-label="Cancelar" className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary">
              <X className="size-4" />
            </button>
          </>
        )}
      </div>
      <p className={error ? "mt-1 text-xs text-destructive" : "mt-1 text-xs text-muted-foreground"}>
        {error
          ? "No parece un link de Google Maps. En Google Maps toca Compartir → Copiar link."
          : ev.mapsUrl ? "El mapa usa este punto exacto. Borra el link para volver a la ubicación automática."
            : "Opcional: pega el link de Compartir de Google Maps para fijar el punto exacto."}
      </p>
    </section>
  );
}
