"use client";
import { useState } from "react";
import type { CalendarEvent, Day, TripSpan } from "@/types";
import { SPAN_COLORS } from "@/constants/spanColors";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LIMITS } from "@/constants/limits";

interface RangesSectionProps {
  selectedEvent: { ev: CalendarEvent; dayId: string };
  days: Day[];
  tripSpans: TripSpan[];
  onAddTripSpan: (span: TripSpan) => void;
  onRemoveTripSpan: (id: string) => void;
}

export default function RangesSection({
  selectedEvent, days, tripSpans, onAddTripSpan, onRemoveTripSpan,
}: RangesSectionProps) {
  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState("");
  const [color, setColor] = useState<string>(SPAN_COLORS[0].id);
  const [role, setRole] = useState<"start" | "end">("start");
  const [partnerId, setPartnerId] = useState("");

  const allEvents = days.flatMap((d) => d.events.map((ev) => ({ day: d, ev })));
  const mySpans = tripSpans.filter(
    (s) => s.startEventId === selectedEvent.ev.id || s.endEventId === selectedEvent.ev.id,
  );

  function saveSpan() {
    if (!partnerId) return;
    const preset = SPAN_COLORS.find((c) => c.id === color) ?? SPAN_COLORS[0];
    onAddTripSpan({
      id: crypto.randomUUID(),
      label: label || preset.label,
      startEventId: role === "start" ? selectedEvent.ev.id : partnerId,
      endEventId:   role === "end"   ? selectedEvent.ev.id : partnerId,
      bg:     preset.bg,
      border: preset.border,
      zIndex: 1,
    });
    setShowForm(false);
    setLabel(""); setPartnerId("");
  }

  return (
    <div className="mt-3.5 border-t border-border pt-3">
      <div className="mb-2 text-[11px] font-semibold tracking-[.06em] text-muted-foreground">RANGOS</div>

      {mySpans.length > 0 && (
        <div className="mb-2 flex flex-col gap-1">
          {mySpans.map((s) => {
            const spanRole = s.startEventId === selectedEvent.ev.id ? "inicio" : "fin";
            const partnerEventId = spanRole === "inicio" ? s.endEventId : s.startEventId;
            const partnerEntry = allEvents.find((x) => x.ev.id === partnerEventId);
            return (
              <div key={s.id} className="flex items-center gap-1.5 text-xs">
                <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: s.border }} />
                <span className="flex-1 truncate text-foreground">
                  {s.label ?? "Rango"} · {spanRole}
                  {partnerEntry && <span className="text-muted-foreground"> → {partnerEntry.day.label} · {partnerEntry.ev.title}</span>}
                </span>
                <button onClick={() => onRemoveTripSpan(s.id)}
                  className="cursor-pointer px-0.5 text-sm leading-none text-muted-foreground hover:text-foreground">×</button>
              </div>
            );
          })}
        </div>
      )}

      {showForm ? (
        <div className="rounded-lg border border-border bg-secondary p-2.5">
          <Input value={label} maxLength={LIMITS.label} onChange={(e) => setLabel(e.target.value)} placeholder="Etiqueta del rango"
            className="mb-[7px] bg-card text-xs" />

          <div className="mb-[7px] flex gap-1.5">
            {SPAN_COLORS.map((c) => (
              <button key={c.id} onClick={() => setColor(c.id)} title={c.label}
                className={cn("h-5 w-5 cursor-pointer rounded-full p-0", color === c.id ? "border-2" : "border-2 border-transparent")}
                style={{ background: c.border, borderColor: color === c.id ? c.border : undefined, boxShadow: color === c.id ? `0 0 0 2px ${c.border}44` : "none" }} />
            ))}
          </div>

          <div className="mb-[7px] flex gap-[5px]">
            {(["start", "end"] as const).map((r) => (
              <button key={r} onClick={() => setRole(r)}
                className={cn(
                  "flex-1 cursor-pointer rounded-md border py-1 text-[11px] font-semibold",
                  role === r ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground",
                )}>
                {r === "start" ? "Este evento es INICIO" : "Este evento es FIN"}
              </button>
            ))}
          </div>

          <select value={partnerId} onChange={(e) => setPartnerId(e.target.value)}
            className="mb-2 w-full rounded-md border border-border bg-card px-2 py-[5px] text-[11px] text-foreground outline-none">
            <option value="">— {role === "start" ? "¿Hasta qué evento?" : "¿Desde qué evento?"} —</option>
            {days.map((d) => {
              const opts = d.events.filter((e) => e.id !== selectedEvent.ev.id);
              if (opts.length === 0) return null;
              return (
                <optgroup key={d.id} label={d.label}>
                  {opts.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
                </optgroup>
              );
            })}
          </select>

          <div className="flex gap-[5px]">
            <Button onClick={saveSpan} disabled={!partnerId} size="sm" className="flex-1 font-bold">✓ Crear</Button>
            <Button variant="outline" size="sm" onClick={() => { setShowForm(false); setLabel(""); setPartnerId(""); }} className="text-muted-foreground">✕</Button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowForm(true)}
          className="w-full cursor-pointer rounded-md border border-dashed border-border bg-transparent py-[5px] text-[11px] text-muted-foreground hover:text-foreground">
          + Crear rango desde este evento
        </button>
      )}
    </div>
  );
}
