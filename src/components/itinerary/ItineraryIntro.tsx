"use client";
import { CalendarPlus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PANEL } from "@/components/home/shared";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";

type View = "agenda" | "grid";

const HINT: Record<View, { touch: string; mouse: string }> = {
  agenda: {
    touch: "Toca + en cualquier día para agregar un plan con hora; todo el grupo ve el mismo itinerario.",
    mouse: "Usa + Actividad en cualquier día para agregar un plan con hora; todo el grupo ve el mismo itinerario.",
  },
  grid: {
    touch: "Toca una hora del calendario para agregar un plan; todo el grupo ve el mismo itinerario.",
    mouse: "Haz clic en una hora del calendario para agregar un plan; todo el grupo ve el mismo itinerario.",
  },
};

interface ItineraryIntroProps {
  view: View;
  // Client point to anchor the new-activity popover (desktop).
  onAdd: (x: number, y: number) => void;
  className?: string;
}

// Shown while the whole itinerary has no activities: what it's for and how to add one.
export default function ItineraryIntro({ view, onAdd, className }: ItineraryIntroProps) {
  const mobile = useIsMobile();
  return (
    <section className={cn(PANEL, "flex flex-col items-start gap-3 sm:flex-row sm:items-center", className)}>
      <CalendarPlus className="size-7 shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <h2 className="text-[15px] font-semibold">Arma el día a día</h2>
        <p className="mt-0.5 text-[13px] text-muted-foreground">{HINT[view][mobile ? "touch" : "mouse"]}</p>
      </div>
      <Button
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          onAdd(r.left, r.bottom);
        }}
        className="rounded-full px-5 font-semibold"
      >
        <Plus />
        Agregar la primera actividad
      </Button>
    </section>
  );
}
