"use client";
import { useState } from "react";
import type { Day, DaySpan, TripSpan } from "@/types";
import { SPAN_COLORS } from "@/constants/spanColors";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface SpansManagerProps {
  days: Day[];
  tripSpans: TripSpan[];
  onRemoveTripSpan: (id: string) => void;
  onUpdateTripSpan: (id: string, patch: Partial<TripSpan>) => void;
  onRemoveDaySpan: (dayId: string, spanId: string) => void;
  onUpdateDaySpan: (dayId: string, spanId: string, patch: Partial<DaySpan>) => void;
}

function matchColor(bg: string, border: string) {
  return SPAN_COLORS.find((c) => c.bg === bg) ??
         SPAN_COLORS.find((c) => c.border === border) ??
         null;
}

function previewColor(bg: string, border: string) {
  if (border && border !== "transparent") return border;
  const match = SPAN_COLORS.find((c) => c.bg === bg);
  return match ? match.border : "#6EE7B7";
}

function SpanCard({ label, bg, border, onRename, onDelete, onColor, subtitle }: {
  label?: string; bg: string; border: string;
  onRename: (v: string) => void; onDelete: () => void;
  onColor: (bg: string, border: string) => void; subtitle: string;
}) {
  const [editing, setEditing] = useState(false);
  const active = matchColor(bg, border);
  const preview = previewColor(bg, border);
  return (
    <div className="overflow-hidden rounded-xl ring-1 ring-border">
      <div className="h-1.5 opacity-70" style={{ background: preview }} />
      <div className="bg-secondary px-2.5 py-2">
        <div className="mb-[7px] flex items-center gap-1.5">
          {editing ? (
            <Input
              autoFocus
              defaultValue={label ?? ""}
              onBlur={(e) => { onRename(e.target.value); setEditing(false); }}
              onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setEditing(false); }}
              className="h-auto flex-1 bg-card px-1.5 py-0.5 text-xs"
            />
          ) : (
            <span
              onClick={() => setEditing(true)}
              title="Clic para editar nombre"
              className="flex-1 cursor-text text-xs font-medium text-foreground"
            >
              {label || <em className="font-normal text-muted-foreground">Sin nombre — clic para editar</em>}
            </span>
          )}
          <button onClick={onDelete} title="Eliminar fondo"
            className="cursor-pointer px-0.5 text-[15px] leading-none text-muted-foreground hover:text-foreground">×</button>
        </div>
        <div className="flex items-center gap-[5px]">
          {SPAN_COLORS.map((c) => (
            <button key={c.id} onClick={() => onColor(c.bg, c.border)} title={c.label}
              className={cn("h-[18px] w-[18px] shrink-0 cursor-pointer rounded-full p-0 transition-all", active?.id === c.id ? "border-[2.5px] border-foreground" : "border-2 border-transparent")}
              style={{ background: c.border, boxShadow: active?.id === c.id ? `0 0 0 1px ${c.border}` : "none" }}
            />
          ))}
          <span className="ml-1.5 flex-1 truncate text-[10px] text-muted-foreground">
            {subtitle}
          </span>
        </div>
      </div>
    </div>
  );
}

// Lists every calendar background ("fondo"): day-level spans and trip-level ranges.
export default function SpansManager({
  days, tripSpans,
  onRemoveTripSpan, onUpdateTripSpan, onRemoveDaySpan, onUpdateDaySpan,
}: SpansManagerProps) {
  const allDaySpans = days.flatMap((d) =>
    (d.spans ?? []).map((s) => ({ dayId: d.id, dayLabel: d.label, span: s }))
  );
  const total = allDaySpans.length + tripSpans.length;
  const allEvents = days.flatMap((d) => d.events);

  return (
    <div className="flex flex-col gap-2">
      {total === 0 && (
        <p className="py-2 text-center text-xs leading-normal text-muted-foreground">
          Sin fondos. Abre una actividad y usa <strong>Rangos</strong> para crear uno.
        </p>
      )}

      {allDaySpans.map(({ dayId, dayLabel, span }) => (
        <SpanCard
          key={span.id}
          label={span.label}
          bg={span.bg}
          border={span.border}
          subtitle={dayLabel}
          onRename={(v) => onUpdateDaySpan(dayId, span.id, { label: v })}
          onDelete={() => onRemoveDaySpan(dayId, span.id)}
          onColor={(bg, border) => onUpdateDaySpan(dayId, span.id, { bg, border })}
        />
      ))}

      {tripSpans.map((span) => {
        const startEv = allEvents.find((e) => e.id === span.startEventId);
        const endEv   = allEvents.find((e) => e.id === span.endEventId);
        return (
          <SpanCard
            key={span.id}
            label={span.label}
            bg={span.bg}
            border={span.border}
            subtitle={`${startEv?.title ?? "?"} → ${endEv?.title ?? "?"}`}
            onRename={(v) => onUpdateTripSpan(span.id, { label: v })}
            onDelete={() => onRemoveTripSpan(span.id)}
            onColor={(bg, border) => onUpdateTripSpan(span.id, { bg, border })}
          />
        );
      })}
    </div>
  );
}
