"use client";
import { useState } from "react";
import { CATEGORIES, EVENT_CATEGORY_KEYS } from "@/constants/categories";
import { HOUR_START, HOUR_END } from "@/constants/time";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import NoteLinks from "@/components/NoteLinks";
import type { CalendarEvent, Day } from "@/types";
import { LIMITS } from "@/constants/limits";

// Decimal hours ↔ "HH:MM"
function toTimeStr(h: number): string {
  const hh = Math.floor(Math.max(0, h));
  const mm = Math.round((h - hh) * 60);
  return `${String(hh).padStart(2, "0")}:${String(mm === 60 ? 0 : mm).padStart(2, "0")}`;
}
function fromTimeStr(t: string): number {
  const [hh, mm] = t.split(":").map(Number);
  return hh + (mm || 0) / 60;
}

interface EventEditorProps {
  ev: CalendarEvent;
  onChange: (patch: Partial<CalendarEvent>) => void;
  onDelete?: () => void;
  deleteLabel?: string;
  // With these, a "Día" picker moves the activity to another day.
  days?: Day[];
  dayId?: string;
  onMoveDay?: (toDayId: string) => void;
}

export default function EventEditor({
  ev, onChange, onDelete, deleteLabel = "Eliminar actividad", days, dayId, onMoveDay,
}: EventEditorProps) {
  return (
    <div className="flex flex-col gap-2.5">
      <Input
        value={ev.title}
        maxLength={LIMITS.title}
        onChange={(e) => onChange({ title: e.target.value })}
        aria-label="Título"
        className="h-10 bg-secondary text-[15px] font-medium"
      />

      {days && dayId && onMoveDay && (
        <label className="text-xs text-secondary-foreground">
          Día
          <select
            value={dayId}
            onChange={(e) => onMoveDay(e.target.value)}
            className="mt-[3px] h-9 w-full cursor-pointer rounded-lg border border-input bg-secondary px-2.5 text-[13px] text-foreground outline-none"
          >
            {days.map((d) => (
              <option key={d.id} value={d.id}>{d.label}{d.sub ? ` — ${d.sub}` : ""}</option>
            ))}
          </select>
        </label>
      )}

      <div className="flex gap-2">
        <TimeField label="Inicio" value={ev.start} min={HOUR_START} max={HOUR_END - 0.25}
          onChange={(v) => onChange({ start: v })} />
        <TimeField label="Fin" value={ev.end} min={HOUR_START + 0.25} max={HOUR_END}
          onChange={(v) => onChange({ end: v })} />
      </div>

      <Textarea
        value={ev.note}
        maxLength={LIMITS.note}
        onChange={(e) => onChange({ note: e.target.value })}
        placeholder="Nota, precios, links…"
        rows={2}
        className="min-h-0 bg-secondary text-[13px] leading-snug"
      />
      <NoteLinks note={ev.note} />

      <div>
        <div className="mb-1.5 text-xs text-secondary-foreground">Categoría</div>
        <div className="flex flex-wrap gap-[5px]">
          {(EVENT_CATEGORY_KEYS.includes(ev.cat) || !CATEGORIES[ev.cat] ? EVENT_CATEGORY_KEYS : [...EVENT_CATEGORY_KEYS, ev.cat]).map((key) => {
            const c = CATEGORIES[key];
            const active = ev.cat === key;
            return (
              <button
                key={key}
                onClick={() => onChange({ cat: key })}
                className={cn(
                  "flex cursor-pointer items-center gap-[5px] rounded-full border-[1.5px] px-[9px] py-1.5 text-[11px] font-medium transition-all md:py-1",
                  !active && "border-border bg-secondary text-muted-foreground",
                )}
                style={active ? { background: c.bg, borderColor: c.border, color: c.text, boxShadow: `0 0 0 2px ${c.border}33` } : undefined}
              >
                <span className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: c.dot }} />
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      {onDelete && (
        <Button
          variant="outline"
          onClick={onDelete}
          className="w-full border-[#F09595] bg-[#FCEBEB] text-xs font-medium text-[#A32D2D] hover:bg-[#FCEBEB]/80 hover:text-[#A32D2D]"
        >
          {deleteLabel}
        </Button>
      )}
    </div>
  );
}

interface TimeFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}

function TimeField({ label, value, min, max, onChange }: TimeFieldProps) {
  const [raw, setRaw] = useState<string | null>(null);
  const displayed = raw !== null ? raw : toTimeStr(value);

  function handleChange(t: string) {
    setRaw(t);
    const parsed = fromTimeStr(t);
    if (!isNaN(parsed) && parsed >= min && parsed <= max) onChange(parsed);
  }

  function handleBlur() {
    setRaw(null);
    // snap to nearest 15 min on blur
    const snapped = Math.round(value * 4) / 4;
    if (snapped !== value) onChange(Math.max(min, Math.min(max, snapped)));
  }

  return (
    <label className="flex-1 text-xs text-secondary-foreground">
      {label}
      <Input
        type="time"
        value={displayed}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={handleBlur}
        className="mt-[3px] h-9 w-full bg-secondary text-[13px] tabular-nums"
      />
    </label>
  );
}
