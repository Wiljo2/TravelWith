"use client";
import { useState } from "react";
import { HOUR_START, HOUR_END } from "@/constants/time";
import EventEditor from "@/components/editor/EventEditor";
import { Button } from "@/components/ui/button";
import type { CalendarEvent } from "@/types";

interface NewEventFormProps {
  defaultHour: number;
  dayLabel: string;
  onSave: (title: string, start: number, end: number, note: string) => void;
  onCancel: () => void;
}

export default function NewEventForm({ defaultHour, dayLabel, onSave, onCancel }: NewEventFormProps) {
  const [draft, setDraft] = useState<CalendarEvent>({
    id: "__new__",
    title: "",
    start: Math.max(HOUR_START, Math.min(defaultHour, HOUR_END - 1)),
    end:   Math.min(defaultHour + 1, HOUR_END),
    cat:   "miami",
    note:  "",
  });

  const canSave = draft.title.trim().length > 0 && draft.end > draft.start;

  return (
    <div className="flex flex-col gap-[9px]">
      <div className="text-[11px] text-muted-foreground">
        <strong className="text-secondary-foreground">{dayLabel}</strong>
      </div>

      <EventEditor
        ev={draft}
        onChange={(patch) => setDraft((prev) => ({ ...prev, ...patch }))}
        onDelete={onCancel}
        deleteLabel="Cancelar"
      />

      <Button
        onClick={() => canSave && onSave(draft.title.trim(), draft.start, draft.end, draft.note ?? "")}
        disabled={!canSave}
        className="w-full font-bold"
      >
        ✓ Guardar actividad
      </Button>

      <div className="text-center text-[10.5px] leading-snug text-muted-foreground">
        Al guardar podrás agregar rangos y gastos vinculados.
      </div>
    </div>
  );
}
