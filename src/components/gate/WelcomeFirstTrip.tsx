"use client";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface WelcomeFirstTripProps {
  name: string;
  panel: ReactNode;
  onCreate: () => void;
  onJoin: () => void;
}

export default function WelcomeFirstTrip({ name, panel, onCreate, onJoin }: WelcomeFirstTripProps) {
  return (
    <div className="flex flex-col gap-3">
      <Card className="rounded-xl py-5">
        <CardContent className="px-5">
          <div className="mb-2 text-[32px] leading-none">🗺️</div>
          <h2 className="mb-1.5 text-lg font-bold">{name ? `Hola, ${name} 👋` : "¡Hola! 👋"}</h2>
          <p className="text-[13px] leading-relaxed text-secondary-foreground">
            Planeemos tu primer viaje en grupo: itinerario, ideas, gastos y pendientes en un solo lugar.
          </p>
        </CardContent>
      </Card>

      {panel ?? (
        <div className="flex flex-col gap-2">
          <Button onClick={onCreate} className="h-11 w-full text-[15px] font-semibold">
            Crear mi primer viaje
          </Button>
          <Button variant="outline" onClick={onJoin} className="h-10 w-full bg-card">
            Tengo un código de invitación
          </Button>
        </div>
      )}
    </div>
  );
}
