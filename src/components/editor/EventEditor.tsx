import { useState } from "react";
import { CATEGORIES } from "@/constants/categories";
import { HOUR_START, HOUR_END } from "@/constants/time";
import { inputStyle } from "@/utils/styles";
import type { CalendarEvent } from "@/types";

const CAT_KEYS = Object.keys(CATEGORIES) as (keyof typeof CATEGORIES)[];

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
  onDelete: () => void;
  deleteLabel?: string;
}

export default function EventEditor({ ev, onChange, onDelete, deleteLabel = "Eliminar actividad" }: EventEditorProps) {
  const activeCat = CATEGORIES[ev.cat] ?? CATEGORIES.logist;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
      <input
        value={ev.title}
        onChange={(e) => onChange({ title: e.target.value })}
        style={inputStyle()}
      />

      <div style={{ display: "flex", gap: 8 }}>
        <TimeField label="Inicio" value={ev.start} min={HOUR_START} max={HOUR_END - 0.25}
          onChange={(v) => onChange({ start: v })} />
        <TimeField label="Fin" value={ev.end} min={HOUR_START + 0.25} max={HOUR_END}
          onChange={(v) => onChange({ end: v })} />
      </div>

      <textarea
        value={ev.note}
        onChange={(e) => onChange({ note: e.target.value })}
        placeholder="Nota..."
        rows={2}
        style={inputStyle({ resize: "vertical", lineHeight: 1.4 })}
      />

      {/* Category picker */}
      <div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>Categoría</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
          {CAT_KEYS.map((key) => {
            const c = CATEGORIES[key];
            const active = ev.cat === key;
            return (
              <button
                key={key}
                onClick={() => onChange({ cat: key })}
                style={{
                  display: "flex", alignItems: "center", gap: 5,
                  padding: "4px 9px", borderRadius: 20, fontSize: 11, fontWeight: 500,
                  cursor: "pointer",
                  background: active ? c.bg : "var(--surface-1)",
                  border: `1.5px solid ${active ? c.border : "var(--border)"}`,
                  color: active ? c.text : "var(--text-muted)",
                  boxShadow: active ? `0 0 0 2px ${c.border}33` : "none",
                  transition: "all .12s",
                }}
              >
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: c.dot, flexShrink: 0 }} />
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      <button
        onClick={onDelete}
        style={{ border: "1px solid #F09595", background: "#FCEBEB", color: "#A32D2D", borderRadius: 6, padding: "6px 0", fontSize: 12, cursor: "pointer", fontWeight: 500 }}
      >
        {deleteLabel}
      </button>
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
    <label style={{ flex: 1, fontSize: 11, color: "var(--text-secondary)" }}>
      {label}
      <input
        type="time"
        value={displayed}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={handleBlur}
        style={inputStyle({ width: "100%", marginTop: 3, fontFamily: "monospace" })}
      />
    </label>
  );
}
