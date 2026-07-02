import { useState } from "react";
import type { CSSProperties } from "react";
import { usdToCop, fmtUSDNum, fmtCOPNum, extraPerPersonUSD } from "../../utils/currency";
import { inputStyle } from "../../utils/styles";
import { HOUR_START, HOUR_END } from "../../constants/time";
import EventEditor from "../editor/EventEditor";
import type { CalendarEvent, Extra, Day, DaySpan, TripSpan, Task } from "../../types";

// ── Color presets for spans ───────────────────────────────────────────────────
const SPAN_COLORS = [
  { id: "azul",    label: "Azul",    bg: "rgba(55,138,221,.06)",  border: "rgba(55,138,221,.30)"  },
  { id: "verde",   label: "Verde",   bg: "rgba(110,231,183,.08)", border: "rgba(74,222,128,.35)"  },
  { id: "naranja", label: "Naranja", bg: "rgba(216,90,48,.06)",   border: "rgba(216,90,48,.35)"   },
  { id: "morado",  label: "Morado",  bg: "rgba(127,119,221,.07)", border: "rgba(127,119,221,.35)" },
  { id: "amarillo",label: "Amarillo",bg: "rgba(239,159,39,.07)",  border: "rgba(239,159,39,.35)"  },
] as const;

const td: CSSProperties = {
  padding: "5px 4px",
  borderBottom: "1px solid var(--border)",
  verticalAlign: "middle",
  fontSize: 12,
};

interface BudgetPanelProps {
  selectedEvent: { ev: CalendarEvent; dayId: string } | null;
  onUpdateEvent: (patch: Partial<CalendarEvent>) => void;
  onDeleteEvent: () => void;
  days: Day[];
  extras: Extra[];
  grandTotal: number;
  exchangeRate: number;
  people: number;
  onSetExchangeRate: (rate: number) => void;
  onUpdateExtraUSD: (id: string, usd: number) => void;
  onUpdateExtraCOP: (id: string, cop: number) => void;
  onUpdateExtraLabel: (id: string, label: string) => void;
  onLinkExtra: (extraId: string, eventId: string | undefined) => void;
  onRemoveExtra: (id: string) => void;
  onAddExtra: (partial?: Partial<Extra>) => void;
  tripSpans: TripSpan[];
  onAddTripSpan: (span: TripSpan) => void;
  onRemoveTripSpan: (id: string) => void;
  onAddDaySpan: (dayId: string, span: DaySpan) => void;
  onRemoveDaySpan: (dayId: string, spanId: string) => void;
  onUpdateDaySpan: (dayId: string, spanId: string, patch: Partial<DaySpan>) => void;
  onUpdateTripSpan: (id: string, patch: Partial<TripSpan>) => void;
  tasks: Task[];
  pendingNew: { dayId: string; hour: number } | null;
  onCommitNew: (title: string, start: number, end: number, note: string) => void;
  onCancelNew: () => void;
}

// ── DeleteConfirm — inline for linked extras ─────────────────────────────────
function DeleteConfirm({ label, onUnlink, onDelete, onCancel }: {
  label: string;
  onUnlink: () => void;
  onDelete: () => void;
  onCancel: () => void;
}) {
  return (
    <div style={{ background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", marginBottom: 6 }}>
      <p style={{ margin: "0 0 8px", fontSize: 12, color: "var(--text-primary)" }}>
        ¿Qué hacemos con <strong>{label}</strong>?
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        <button onClick={onUnlink} style={btnStyle("#3B82F6")}>Solo desvincular</button>
        <button onClick={onDelete} style={btnStyle("#EF4444")}>Eliminar del presupuesto</button>
        <button onClick={onCancel} style={{ ...btnStyle("var(--border)"), color: "var(--text-muted)", background: "none" }}>Cancelar</button>
      </div>
    </div>
  );
}

function btnStyle(color: string): CSSProperties {
  return { border: `1px solid ${color}`, borderRadius: 6, padding: "5px 0", fontSize: 11, cursor: "pointer", fontWeight: 500, background: `${color}22`, color: color };
}

// ── AddGastoForm ──────────────────────────────────────────────────────────────
function AddGastoForm({ defaultLabel, onSave, onCancel }: {
  defaultLabel: string;
  onSave: (label: string, amount: number, currency: "USD" | "COP") => void;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState(defaultLabel);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<"USD" | "COP">("USD");

  function save() {
    const v = parseFloat(amount.replace(/\./g, "").replace(",", ".")) || 0;
    onSave(label, v, currency);
  }

  return (
    <div style={{ background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px", marginTop: 6 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 7, letterSpacing: ".06em" }}>NUEVO GASTO</div>
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Concepto"
        style={{ width: "100%", boxSizing: "border-box", padding: "5px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text-primary)", fontSize: 12, outline: "none", marginBottom: 6 }}
      />
      <div style={{ display: "flex", gap: 5, marginBottom: 8 }}>
        <button
          onClick={() => setCurrency((c) => c === "USD" ? "COP" : "USD")}
          style={{ padding: "5px 8px", borderRadius: 6, border: "1px solid var(--border)", background: currency === "COP" ? "#4ADE8022" : "#60A5FA22", color: currency === "COP" ? "#4ADE80" : "#60A5FA", fontWeight: 700, fontSize: 11, cursor: "pointer", flexShrink: 0 }}
        >
          {currency}
        </button>
        <input
          autoFocus
          type="text" inputMode="numeric"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") onCancel(); }}
          placeholder="0"
          style={{ flex: 1, padding: "5px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text-primary)", fontSize: 12, outline: "none", textAlign: "right", fontFamily: "monospace" }}
        />
      </div>
      <div style={{ display: "flex", gap: 5 }}>
        <button onClick={save} style={{ flex: 1, padding: "6px", borderRadius: 6, border: "none", background: "#6EE7B7", color: "#04342C", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>✓ Guardar</button>
        <button onClick={onCancel} style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 13 }}>✕</button>
      </div>
    </div>
  );
}

// ── NewEventForm — misma UI que EventEditor + botón Guardar ──────────────────
function NewEventForm({ defaultHour, dayLabel, onSave, onCancel }: {
  defaultHour: number;
  dayLabel: string;
  onSave: (title: string, start: number, end: number, note: string) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<import("../../types").CalendarEvent>({
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

// ── TaskPreview ────────────────────────────────────────────────────────────────
function TaskPreview({ tasks }: { tasks: Task[] }) {
  const pending = tasks.filter((t) => !t.done);
  const done    = tasks.filter((t) => t.done);
  const MAX_SHOW = 5;

  return (
    <div style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 10, padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>Tareas</div>
        {pending.length > 0 && (
          <div style={{
            fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 20,
            background: "rgba(239,159,39,.12)", border: "1px solid rgba(239,159,39,.3)",
            color: "#A36200",
          }}>
            {pending.length} pendiente{pending.length !== 1 ? "s" : ""}
          </div>
        )}
      </div>

      {pending.length === 0 ? (
        <div style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", padding: "10px 0" }}>
          {tasks.length === 0 ? "Sin tareas aún" : "¡Todo al día!"}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {pending.slice(0, MAX_SHOW).map((t) => (
            <div key={t.id} style={{ display: "flex", alignItems: "flex-start", gap: 7, fontSize: 12 }}>
              <span style={{
                width: 14, height: 14, borderRadius: 4, border: "1.5px solid var(--border)",
                flexShrink: 0, marginTop: 1, display: "inline-block",
              }} />
              <span style={{ color: "var(--text-secondary)", lineHeight: 1.35, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {t.title}
              </span>
            </div>
          ))}
          {pending.length > MAX_SHOW && (
            <div style={{ fontSize: 11, color: "var(--text-muted)", paddingLeft: 21 }}>
              y {pending.length - MAX_SHOW} más...
            </div>
          )}
        </div>
      )}

      {done.length > 0 && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--border)", fontSize: 11, color: "var(--text-muted)" }}>
          {done.length} completada{done.length !== 1 ? "s" : ""}
        </div>
      )}
    </div>
  );
}

export default function BudgetPanel({
  selectedEvent, onUpdateEvent, onDeleteEvent,
  days, extras, grandTotal, exchangeRate, people,
  onLinkExtra, onAddExtra, onRemoveExtra,
  tripSpans, onAddTripSpan, onRemoveTripSpan, onUpdateTripSpan,
  onAddDaySpan, onRemoveDaySpan, onUpdateDaySpan,
  tasks, pendingNew, onCommitNew, onCancelNew,
}: BudgetPanelProps) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showSpanForm, setShowSpanForm] = useState(false);
  const [spanLabel, setSpanLabel] = useState("");
  const [spanColor, setSpanColor] = useState<string>(SPAN_COLORS[0].id);
  const [spanRole, setSpanRole] = useState<"start" | "end">("start");
  const [spanPartnerId, setSpanPartnerId] = useState("");
  const [showFondos, setShowFondos] = useState(true);
  const [editingSpanId, setEditingSpanId] = useState<string | null>(null);

  const allEvents = days.flatMap((d) => d.events.map((ev) => ({ day: d, ev })));
  const mySpans = selectedEvent
    ? tripSpans.filter((s) => s.startEventId === selectedEvent.ev.id || s.endEventId === selectedEvent.ev.id)
    : [];

  function saveSpan() {
    if (!selectedEvent || !spanPartnerId) return;
    const preset = SPAN_COLORS.find((c) => c.id === spanColor) ?? SPAN_COLORS[0];
    const newSpan: TripSpan = {
      id: crypto.randomUUID(),
      label: spanLabel || preset.label,
      startEventId: spanRole === "start" ? selectedEvent.ev.id : spanPartnerId,
      endEventId:   spanRole === "end"   ? selectedEvent.ev.id : spanPartnerId,
      bg:     preset.bg,
      border: preset.border,
      zIndex: 1,
    };
    onAddTripSpan(newSpan);
    setShowSpanForm(false);
    setSpanLabel(""); setSpanPartnerId("");
  }

  const linkedExtras = selectedEvent
    ? extras.filter((x) => x.linkedEventId === selectedEvent.ev.id)
    : [];
  const unlinkableExtras = selectedEvent
    ? extras.filter((x) => x.linkedEventId !== selectedEvent.ev.id)
    : [];

  function handleAddGasto(label: string, amount: number, currency: "USD" | "COP") {
    if (!selectedEvent) return;
    onAddExtra({ label, amount, currency, linkedEventId: selectedEvent.ev.id });
    setShowAddForm(false);
  }

  const pendingDay = pendingNew ? days.find((d) => d.id === pendingNew.dayId) : null;

  return (
    <div style={{ width: 300, flexShrink: 0, display: "flex", flexDirection: "column", gap: 10 }}>

      {/* Event editor / new event form */}
      <div style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 10, padding: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
          {selectedEvent ? "Editar actividad" : pendingNew ? "Nueva actividad" : "Selecciona un bloque"}
        </div>

        {selectedEvent ? (
          <>
            <EventEditor ev={selectedEvent.ev} onChange={onUpdateEvent} onDelete={onDeleteEvent} />

            {/* ── Rangos section ── */}
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", letterSpacing: ".06em", marginBottom: 8 }}>RANGOS</div>

              {mySpans.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 8 }}>
                  {mySpans.map((s) => {
                    const role = s.startEventId === selectedEvent?.ev.id ? "inicio" : "fin";
                    const partnerId = role === "inicio" ? s.endEventId : s.startEventId;
                    const partnerEntry = allEvents.find((x) => x.ev.id === partnerId);
                    return (
                      <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                        <span style={{ width: 10, height: 10, borderRadius: 3, background: s.border, flexShrink: 0 }} />
                        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text-primary)" }}>
                          {s.label ?? "Rango"} · {role}
                          {partnerEntry && <span style={{ color: "var(--text-muted)" }}> → {partnerEntry.day.label} · {partnerEntry.ev.title}</span>}
                        </span>
                        <button onClick={() => onRemoveTripSpan(s.id)}
                          style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 14, padding: "0 2px", lineHeight: 1 }}>×</button>
                      </div>
                    );
                  })}
                </div>
              )}

              {showSpanForm ? (
                <div style={{ background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: 8, padding: 10 }}>
                  <input value={spanLabel} onChange={(e) => setSpanLabel(e.target.value)} placeholder="Etiqueta del rango"
                    style={{ width: "100%", boxSizing: "border-box", padding: "5px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text-primary)", fontSize: 12, outline: "none", marginBottom: 7 }} />

                  <div style={{ display: "flex", gap: 6, marginBottom: 7 }}>
                    {SPAN_COLORS.map((c) => (
                      <button key={c.id} onClick={() => setSpanColor(c.id)} title={c.label}
                        style={{ width: 20, height: 20, borderRadius: "50%", border: spanColor === c.id ? `2px solid ${c.border}` : "2px solid transparent", background: c.border, cursor: "pointer", padding: 0, boxShadow: spanColor === c.id ? `0 0 0 2px ${c.border}44` : "none" }} />
                    ))}
                  </div>

                  <div style={{ display: "flex", gap: 5, marginBottom: 7 }}>
                    {(["start", "end"] as const).map((r) => (
                      <button key={r} onClick={() => setSpanRole(r)}
                        style={{ flex: 1, padding: "4px 0", borderRadius: 6, border: "1px solid var(--border)", background: spanRole === r ? "#6EE7B7" : "var(--surface-2)", color: spanRole === r ? "#04342C" : "var(--text-muted)", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>
                        {r === "start" ? "Este evento es INICIO" : "Este evento es FIN"}
                      </button>
                    ))}
                  </div>

                  <select value={spanPartnerId} onChange={(e) => setSpanPartnerId(e.target.value)}
                    style={{ width: "100%", fontSize: 11, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 6, padding: "5px 8px", color: "var(--text-primary)", outline: "none", marginBottom: 8 }}>
                    <option value="">— {spanRole === "start" ? "¿Hasta qué evento?" : "¿Desde qué evento?"} —</option>
                    {days.map((d) => {
                      const opts = d.events.filter((e) => e.id !== selectedEvent?.ev.id);
                      if (opts.length === 0) return null;
                      return (
                        <optgroup key={d.id} label={d.label}>
                          {opts.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
                        </optgroup>
                      );
                    })}
                  </select>

                  <div style={{ display: "flex", gap: 5 }}>
                    <button onClick={saveSpan} disabled={!spanPartnerId}
                      style={{ flex: 1, padding: "6px", borderRadius: 6, border: "none", background: spanPartnerId ? "#6EE7B7" : "var(--border)", color: spanPartnerId ? "#04342C" : "var(--text-muted)", fontWeight: 700, cursor: spanPartnerId ? "pointer" : "default", fontSize: 12 }}>✓ Crear</button>
                    <button onClick={() => { setShowSpanForm(false); setSpanLabel(""); setSpanPartnerId(""); }}
                      style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 12 }}>✕</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setShowSpanForm(true)}
                  style={{ width: "100%", padding: "5px", borderRadius: 6, border: "1px dashed var(--border)", background: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 11 }}>
                  + Crear rango desde este evento
                </button>
              )}
            </div>

            {/* Linked budget items */}
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", letterSpacing: ".06em", marginBottom: 8 }}>GASTOS VINCULADOS</div>

              {linkedExtras.length === 0
                ? <p style={{ margin: "0 0 8px", fontSize: 12, color: "var(--text-muted)" }}>Sin gastos asignados</p>
                : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 8 }}>
                    {linkedExtras.map((x) => {
                      if (confirmDeleteId === x.id) {
                        return (
                          <DeleteConfirm
                            key={x.id}
                            label={x.label}
                            onUnlink={() => { onLinkExtra(x.id, undefined); setConfirmDeleteId(null); }}
                            onDelete={() => { onRemoveExtra(x.id); setConfirmDeleteId(null); }}
                            onCancel={() => setConfirmDeleteId(null)}
                          />
                        );
                      }
                      const displayAmt = x.currency === "COP"
                        ? `${Math.round(x.amount).toLocaleString("es-CO")} COP`
                        : `$${fmtUSDNum(x.amount)}`;
                      return (
                        <div key={x.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12 }}>
                          <span style={{ color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 130 }}>{x.label}</span>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontFamily: "monospace", color: "var(--text-secondary)", fontSize: 11 }}>{displayAmt}</span>
                            <button
                              onClick={() => setConfirmDeleteId(x.id)}
                              style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 14, padding: "0 2px", lineHeight: 1 }}
                            >×</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )
              }

              {unlinkableExtras.length > 0 && (
                <select value="" onChange={(e) => e.target.value && onLinkExtra(e.target.value, selectedEvent.ev.id)}
                  style={{ width: "100%", fontSize: 11, color: "var(--text-muted)", background: "var(--surface-1)", border: "1px dashed var(--border)", borderRadius: 6, padding: "5px 8px", cursor: "pointer", outline: "none", marginBottom: 6 }}>
                  <option value="">+ vincular gasto existente</option>
                  {unlinkableExtras.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
                </select>
              )}

              {showAddForm ? (
                <AddGastoForm
                  defaultLabel={selectedEvent.ev.title}
                  onSave={handleAddGasto}
                  onCancel={() => setShowAddForm(false)}
                />
              ) : (
                <button
                  onClick={() => setShowAddForm(true)}
                  style={{ width: "100%", padding: "6px", borderRadius: 6, border: "none", background: "#6EE7B7", color: "#04342C", fontWeight: 600, cursor: "pointer", fontSize: 12 }}
                >
                  + Nuevo gasto para esta actividad
                </button>
              )}
            </div>
          </>
        ) : pendingNew ? (
          <NewEventForm
            key={`${pendingNew.dayId}-${pendingNew.hour}`}
            defaultHour={pendingNew.hour}
            dayLabel={pendingDay?.label ?? ""}
            onSave={onCommitNew}
            onCancel={onCancelNew}
          />
        ) : (
          <div style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.5 }}>
            Haz clic en cualquier espacio vacío del calendario para agregar una actividad.
          </div>
        )}
      </div>

      {/* Task preview */}
      <TaskPreview tasks={tasks} />

      {/* Fondos del calendario */}
      {(() => {
        const allDaySpans = days.flatMap((d) =>
          (d.spans ?? []).map((s) => ({ kind: "day" as const, dayId: d.id, dayLabel: d.label, span: s }))
        );
        const allTripSpans = tripSpans.map((s) => ({ kind: "trip" as const, span: s }));
        const total = allDaySpans.length + allTripSpans.length;

        // Find best matching preset color (check bg first, then border)
        function matchColor(bg: string, border: string) {
          return SPAN_COLORS.find((c) => c.bg === bg) ??
                 SPAN_COLORS.find((c) => c.border === border) ??
                 null;
        }

        // Solid preview color: use border if not transparent, otherwise derive from bg
        function previewColor(bg: string, border: string) {
          if (border && border !== "transparent") return border;
          // Convert rgba bg to a more opaque version for visual preview
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
            <div style={{
              borderRadius: 8, overflow: "hidden",
              border: `1px solid var(--border)`,
            }}>
              {/* Color strip at top */}
              <div style={{ height: 6, background: preview, opacity: .7 }} />
              <div style={{ padding: "8px 10px", background: "var(--surface-1)" }}>
                {/* Label row */}
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
                {/* Color picker */}
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

        return (
          <div style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
            <button
              onClick={() => setShowFondos((v) => !v)}
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
                <span style={{ fontSize: 14, opacity: .4 }}>{showFondos ? "▲" : "▼"}</span>
              </div>
            </button>

            {showFondos && (
              <div style={{ borderTop: "1px solid var(--border)", padding: "10px 14px", display: "flex", flexDirection: "column", gap: 7 }}>
                {total === 0 ? (
                  <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)", textAlign: "center", padding: "8px 0", lineHeight: 1.5 }}>
                    Sin fondos. Selecciona una actividad y usa la sección <strong>RANGOS</strong> para crear uno.
                  </p>
                ) : null}

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

                {allTripSpans.map(({ span }) => {
                  const allEvs = days.flatMap((d) => d.events);
                  const startEv = allEvs.find((e) => e.id === span.startEventId);
                  const endEv   = allEvs.find((e) => e.id === span.endEventId);
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
      })()}

      {/* Budget preview — per-person only */}
      <div style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 10, padding: 14 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Por persona</div>
          <div style={{ fontSize: 10, color: "var(--text-muted)", background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: 20, padding: "2px 8px" }}>
            {people} {people === 1 ? "persona" : "personas"}
          </div>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            {extras.map((x) => {
              const pax = extraPerPersonUSD(x, people, exchangeRate);
              return (
                <tr key={x.id}>
                  <td style={{ ...td, color: "var(--text-secondary)", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {x.linkedEventId && <span style={{ display: "inline-block", width: 5, height: 5, borderRadius: "50%", background: "#6EE7B7", marginRight: 4, verticalAlign: "middle" }} />}
                    {x.splitMode === "perPerson" && <span title="Por persona" style={{ display: "inline-block", fontSize: 9, fontWeight: 700, color: "#F59E0B", marginRight: 4 }}>/p</span>}
                    {x.label}
                  </td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: "var(--text-primary)", whiteSpace: "nowrap" }}>
                    ${fmtUSDNum(pax)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td style={{ paddingTop: 8, fontSize: 13, fontWeight: 600 }}>Total / pax</td>
              <td style={{ paddingTop: 8, textAlign: "right", fontSize: 13, fontWeight: 600, fontFamily: "monospace" }}>
                ${fmtUSDNum(grandTotal / people)}
              </td>
            </tr>
            <tr>
              <td colSpan={2} style={{ paddingTop: 1, textAlign: "right", fontSize: 11, color: "var(--text-muted)", fontFamily: "monospace" }}>
                {fmtCOPNum(usdToCop(grandTotal / people, exchangeRate))} COP
              </td>
            </tr>
          </tfoot>
        </table>

        <div style={{ marginTop: 10, fontSize: 11, color: "var(--text-muted)", textAlign: "center" }}>
          Edita los montos en la pestaña <strong>Presupuesto</strong>
        </div>
      </div>
    </div>
  );
}
