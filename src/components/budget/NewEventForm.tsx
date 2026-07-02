"use client";
import { useState } from "react";
import { HOUR_START, HOUR_END } from "@/constants/time";
import EventEditor from "@/components/editor/EventEditor";
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
    <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
        <strong style={{ color: "var(--text-secondary)" }}>{dayLabel}</strong>
      </div>

      <EventEditor
        ev={draft}
        onChange={(patch) => setDraft((prev) => ({ ...prev, ...patch }))}
        onDelete={onCancel}
        deleteLabel="Cancelar"
      />

      <button
        onClick={() => canSave && onSave(draft.title.trim(), draft.start, draft.end, draft.note ?? "")}
        disabled={!canSave}
        style={{
          width: "100%", padding: "8px", borderRadius: 6, border: "none",
          background: canSave ? "#6EE7B7" : "var(--border)",
          color: canSave ? "#04342C" : "var(--text-muted)",
          fontWeight: 700, cursor: canSave ? "pointer" : "default", fontSize: 13,
        }}
      >
        ✓ Guardar actividad
      </button>

      <div style={{ fontSize: 10.5, color: "var(--text-muted)", lineHeight: 1.4, textAlign: "center" }}>
        Al guardar podrás agregar rangos y gastos vinculados.
      </div>
    </div>
  );
}
