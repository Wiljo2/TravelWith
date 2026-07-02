"use client";
import { useState } from "react";
import type { CSSProperties } from "react";
import type { CalendarEvent, Extra } from "@/types";
import { fmtUSDNum } from "@/utils/currency";

interface LinkedExtrasSectionProps {
  selectedEvent: { ev: CalendarEvent; dayId: string };
  extras: Extra[];
  onLinkExtra: (extraId: string, eventId: string | undefined) => void;
  onAddExtra: (partial?: Partial<Extra>) => void;
  onRemoveExtra: (id: string) => void;
}

function btnStyle(color: string): CSSProperties {
  return { border: `1px solid ${color}`, borderRadius: 6, padding: "5px 0", fontSize: 11, cursor: "pointer", fontWeight: 500, background: `${color}22`, color: color };
}

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

export default function LinkedExtrasSection({
  selectedEvent, extras, onLinkExtra, onAddExtra, onRemoveExtra,
}: LinkedExtrasSectionProps) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  const linked = extras.filter((x) => x.linkedEventId === selectedEvent.ev.id);
  const linkable = extras.filter((x) => x.linkedEventId !== selectedEvent.ev.id);

  return (
    <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", letterSpacing: ".06em", marginBottom: 8 }}>GASTOS VINCULADOS</div>

      {linked.length === 0
        ? <p style={{ margin: "0 0 8px", fontSize: 12, color: "var(--text-muted)" }}>Sin gastos asignados</p>
        : (
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 8 }}>
            {linked.map((x) => {
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

      {linkable.length > 0 && (
        <select value="" onChange={(e) => e.target.value && onLinkExtra(e.target.value, selectedEvent.ev.id)}
          style={{ width: "100%", fontSize: 11, color: "var(--text-muted)", background: "var(--surface-1)", border: "1px dashed var(--border)", borderRadius: 6, padding: "5px 8px", cursor: "pointer", outline: "none", marginBottom: 6 }}>
          <option value="">+ vincular gasto existente</option>
          {linkable.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
        </select>
      )}

      {showAddForm ? (
        <AddGastoForm
          defaultLabel={selectedEvent.ev.title}
          onSave={(label, amount, currency) => {
            onAddExtra({ label, amount, currency, linkedEventId: selectedEvent.ev.id });
            setShowAddForm(false);
          }}
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
  );
}
