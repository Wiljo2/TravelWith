"use client";
import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";

// Over the map while no activity has a pin; the map stays draggable around the card.
export default function MapEmptyState({ onOpenItinerary }: { onOpenItinerary?: () => void }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-4">
      <div className="pointer-events-auto flex max-w-xs flex-col items-center gap-3 rounded-2xl bg-card/95 p-5 text-center shadow-md ring-1 ring-border backdrop-blur">
        <MapPin className="size-7 text-primary" />
        <div>
          <h2 className="text-[15px] font-semibold">Aún no hay lugares en el mapa</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Las actividades del itinerario aparecen aquí como pines cuando tienen un lugar (su nombre o un link de Google Maps).
          </p>
        </div>
        {onOpenItinerary && (
          <Button onClick={onOpenItinerary} className="rounded-full px-5 font-semibold">Ir al itinerario</Button>
        )}
      </div>
    </div>
  );
}
