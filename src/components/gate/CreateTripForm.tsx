"use client";
import { useState } from "react";
import type { TripInfo } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

interface CreateTripFormProps {
  loading: boolean;
  error: string;
  onSubmit: (trip: TripInfo) => void;
  onCancel: () => void;
}

export default function CreateTripForm({ loading, error, onSubmit, onCancel }: CreateTripFormProps) {
  const [name, setName] = useState("");
  const [destination, setDestination] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const canCreate = name.trim().length > 0 && !!startDate && !!endDate && startDate <= endDate;

  function submit() {
    if (!canCreate) return;
    onSubmit({ name: name.trim(), destination: destination.trim() || undefined, startDate, endDate });
  }

  return (
    <Card className="rounded-xl py-4">
      <CardContent className="flex flex-col gap-2.5 px-4">
        <div className="text-[11px] font-semibold tracking-[.06em] text-muted-foreground">NUEVO VIAJE</div>
        <Input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nombre del viaje (ej. Vacaciones 2027)"
          maxLength={80}
          className="bg-secondary text-sm"
        />
        <Input
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          placeholder="Destino (opcional)"
          maxLength={80}
          className="bg-secondary text-sm"
        />
        <div className="flex gap-2">
          <label className="flex-1 text-[11px] text-secondary-foreground">
            Inicio
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1 bg-secondary text-[13px]" />
          </label>
          <label className="flex-1 text-[11px] text-secondary-foreground">
            Fin
            <Input type="date" value={endDate} min={startDate || undefined} onChange={(e) => setEndDate(e.target.value)} className="mt-1 bg-secondary text-[13px]" />
          </label>
        </div>
        <div className="flex gap-2">
          <Button onClick={submit} disabled={loading || !canCreate} className="flex-1 font-semibold">
            {loading ? "Creando..." : "Crear viaje"}
          </Button>
          <Button variant="outline" onClick={onCancel} className="text-muted-foreground">
            ×
          </Button>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
