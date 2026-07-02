"use client";
import { useState } from "react";
import type { Day, DaySpan, TripSpan } from "@/types";
import { SPAN_COLORS } from "@/constants/spanColors";

interface CalendarSpansCardProps {
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
    <div style={{ borderRadius: 8, overflow: "hidden", border: `1px solid var(--border)` }}>
      <div style={{ height: 6, background: preview, opacity: .7 }} />
      <div style={{ padding: "8px 10px", background: "var(--surface-1)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 7 }}>
          {editing ? (
            <input
              autoFocus
              defaultValue={label ?? ""}
              onBlur={(e) => { onRename(e.target.value); setEditing(false); }}
              onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setEditing(false); }}
              style={{ flex: 1, fontSize: 12, padding: "2px 6px", borderRadius: 5, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text-primary)", outline: "none" }}
            />
          ) : (
            <span
              onClick={() => setEditing(true)}
              title="Clic para editar nombre"
              style={{ flex: 1, fontSize: 12, fontWeight: 500, color: "var(--text-primary)", cursor: "text" }}
            >
              {label || <em style={{ color: "var(--text-muted)", fontWeight: 400 }}>Sin nombre — clic para editar</em>}
            </span>
          )}
          <button onClick={onDelete} title="Eliminar fondo"
            style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 15, padding: "0 2px", lineHeight: 1 }}>×</button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          {SPAN_COLORS.map((c) => (
            <button key={c.id} onClick={() => onColor(c.bg, c.border)} title={c.label}
              style={{
                width: 18, height: 18, borderRadius: "50%", padding: 0, cursor: "pointer",
                background: c.border, flexShrink: 0,
                border: active?.id === c.id ? `2.5px solid var(--text-primary)` : "2px solid transparent",
                boxShadow: active?.id === c.id ? `0 0 0 1px ${c.border}` : "none",
                transition: "all .1s",
              }}
            />
          ))}
          <span style={{ marginLeft: 6, fontSize: 10, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
            {subtitle}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function CalendarSpansCard({
  days, tripSpans,
  onRemoveTripSpan, onUpdateTripSpan, onRemoveDaySpan, onUpdateDaySpan,
}: CalendarSpansCardProps) {
  const [open, setOpen] = useState(true);

  const allDaySpans = days.flatMap((d) =>
    (d.spans ?? []).map((s) => ({ dayId: d.id, dayLabel: d.label, span: s }))
  );
  const total = allDaySpans.length + tripSpans.length;
  const allEvents = days.flatMap((d) => d.events);

  return (
    <div style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "11px 14px", background: "none", border: "none",
          color: "var(--text-primary)", cursor: "pointer", fontSize: 13, fontWeight: 600,
        }}
      >
        <span>Fondos del calendario</span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {total > 0 && (
            <span style={{
              fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 20,
              background: "var(--surface-1)", border: "1px solid var(--border)", color: "var(--text-muted)",
            }}>{total}</span>
          )}
          <span style={{ fontSize: 14, opacity: .4 }}>{open ? "▲" : "▼"}</span>
        </div>
      </button>

      {open && (
        <div style={{ borderTop: "1px solid var(--border)", padding: "10px 14px", display: "flex", flexDirection: "column", gap: 7 }}>
          {total === 0 && (
            <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)", textAlign: "center", padding: "8px 0", lineHeight: 1.5 }}>
              Sin fondos. Selecciona una actividad y usa la sección <strong>RANGOS</strong> para crear uno.
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
      )}
    </div>
  );
}
