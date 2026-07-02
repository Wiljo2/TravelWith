"use client";
import { useState } from "react";
import type { CalendarEvent, Day, TripSpan } from "@/types";
import { SPAN_COLORS } from "@/constants/spanColors";

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
    <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", letterSpacing: ".06em", marginBottom: 8 }}>RANGOS</div>

      {mySpans.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 8 }}>
          {mySpans.map((s) => {
            const spanRole = s.startEventId === selectedEvent.ev.id ? "inicio" : "fin";
            const partnerEventId = spanRole === "inicio" ? s.endEventId : s.startEventId;
            const partnerEntry = allEvents.find((x) => x.ev.id === partnerEventId);
            return (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: s.border, flexShrink: 0 }} />
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text-primary)" }}>
                  {s.label ?? "Rango"} · {spanRole}
                  {partnerEntry && <span style={{ color: "var(--text-muted)" }}> → {partnerEntry.day.label} · {partnerEntry.ev.title}</span>}
                </span>
                <button onClick={() => onRemoveTripSpan(s.id)}
                  style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 14, padding: "0 2px", lineHeight: 1 }}>×</button>
              </div>
            );
          })}
        </div>
      )}

      {showForm ? (
        <div style={{ background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: 8, padding: 10 }}>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Etiqueta del rango"
            style={{ width: "100%", boxSizing: "border-box", padding: "5px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text-primary)", fontSize: 12, outline: "none", marginBottom: 7 }} />

          <div style={{ display: "flex", gap: 6, marginBottom: 7 }}>
            {SPAN_COLORS.map((c) => (
              <button key={c.id} onClick={() => setColor(c.id)} title={c.label}
                style={{ width: 20, height: 20, borderRadius: "50%", border: color === c.id ? `2px solid ${c.border}` : "2px solid transparent", background: c.border, cursor: "pointer", padding: 0, boxShadow: color === c.id ? `0 0 0 2px ${c.border}44` : "none" }} />
            ))}
          </div>

          <div style={{ display: "flex", gap: 5, marginBottom: 7 }}>
            {(["start", "end"] as const).map((r) => (
              <button key={r} onClick={() => setRole(r)}
                style={{ flex: 1, padding: "4px 0", borderRadius: 6, border: "1px solid var(--border)", background: role === r ? "#6EE7B7" : "var(--surface-2)", color: role === r ? "#04342C" : "var(--text-muted)", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>
                {r === "start" ? "Este evento es INICIO" : "Este evento es FIN"}
              </button>
            ))}
          </div>

          <select value={partnerId} onChange={(e) => setPartnerId(e.target.value)}
            style={{ width: "100%", fontSize: 11, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 6, padding: "5px 8px", color: "var(--text-primary)", outline: "none", marginBottom: 8 }}>
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

          <div style={{ display: "flex", gap: 5 }}>
            <button onClick={saveSpan} disabled={!partnerId}
              style={{ flex: 1, padding: "6px", borderRadius: 6, border: "none", background: partnerId ? "#6EE7B7" : "var(--border)", color: partnerId ? "#04342C" : "var(--text-muted)", fontWeight: 700, cursor: partnerId ? "pointer" : "default", fontSize: 12 }}>✓ Crear</button>
            <button onClick={() => { setShowForm(false); setLabel(""); setPartnerId(""); }}
              style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 12 }}>✕</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowForm(true)}
          style={{ width: "100%", padding: "5px", borderRadius: 6, border: "1px dashed var(--border)", background: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 11 }}>
          + Crear rango desde este evento
        </button>
      )}
    </div>
  );
}
