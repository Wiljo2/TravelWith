"use client";
import { useState } from "react";
import { Plus, X } from "lucide-react";

interface PlacesEditorProps {
  places: string[];            // areas: editable
  venues: string[];            // spots read from the itinerary
  onAdd: (place: string) => void;
  onRemove: (place: string) => void;
}

// The trip's places used to organize ideas. Seeded from the itinerary; editable.
export default function PlacesEditor({ places, venues, onAdd, onRemove }: PlacesEditorProps) {
  const [draft, setDraft] = useState("");

  function add() {
    const place = draft.trim();
    if (place && !places.some((p) => p.toLowerCase() === place.toLowerCase())) onAdd(place);
    setDraft("");
  }

  return (
    <div>
      <p className="mb-2 text-xs text-muted-foreground">
        Zonas del viaje. Salen del itinerario; agrega o quita para organizar mejor las ideas.
      </p>
      <div className="flex flex-wrap gap-1.5">
        {places.map((p) => (
          <span key={p} className="flex items-center gap-1 rounded-full bg-secondary py-1 pl-3 pr-1 text-xs ring-1 ring-border">
            📍 {p}
            <button onClick={() => onRemove(p)} aria-label={`Quitar ${p}`} className="flex h-5 w-5 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:bg-card hover:text-foreground">
              <X className="size-3" />
            </button>
          </span>
        ))}
        <span className="flex items-center gap-1 rounded-full py-0.5 pl-3 pr-1 ring-1 ring-dashed ring-border">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") add(); }}
            placeholder="Nuevo lugar"
            className="w-24 bg-transparent text-xs outline-none"
          />
          <button onClick={add} aria-label="Agregar lugar" className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground">
            <Plus className="size-3.5" />
          </button>
        </span>
      </div>
      {venues.length > 0 && (
        <>
          <p className="mb-2 mt-4 text-xs text-muted-foreground">
            Sitios de las actividades del itinerario. Se actualizan solos cuando cambia el plan.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {venues.map((v) => (
              <span key={v} className="rounded-full bg-secondary px-3 py-1 text-xs text-secondary-foreground">{v}</span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
