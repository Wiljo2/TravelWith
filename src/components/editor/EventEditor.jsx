import { CATEGORIES } from "../../constants/categories";
import { HOUR_START, HOUR_END } from "../../constants/time";
import { fmtHour } from "../../utils/time";
import { inputStyle } from "../../utils/styles";

export default function EventEditor({ ev, onChange, onDelete }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
      <input
        value={ev.title}
        onChange={(e) => onChange({ title: e.target.value })}
        style={inputStyle()}
      />

      <div style={{ display: "flex", gap: 8 }}>
        <TimeField label="Inicio" value={ev.start} onChange={(v) => onChange({ start: v })} />
        <TimeField label="Fin"    value={ev.end}   onChange={(v) => onChange({ end: v })} />
      </div>

      <select
        value={ev.cat}
        onChange={(e) => onChange({ cat: e.target.value })}
        style={inputStyle({ cursor: "pointer" })}
      >
        {Object.entries(CATEGORIES).map(([k, c]) => (
          <option key={k} value={k}>{c.label}</option>
        ))}
      </select>

      <textarea
        value={ev.note}
        onChange={(e) => onChange({ note: e.target.value })}
        placeholder="Nota..."
        rows={2}
        style={inputStyle({ resize: "vertical", lineHeight: 1.4 })}
      />

      <button
        onClick={onDelete}
        style={{
          border: "1px solid #F09595",
          background: "#FCEBEB",
          color: "#A32D2D",
          borderRadius: 6,
          padding: "6px 0",
          fontSize: 12,
          cursor: "pointer",
          fontWeight: 500,
        }}
      >
        Eliminar actividad
      </button>
    </div>
  );
}

function TimeField({ label, value, onChange }) {
  return (
    <label style={{ flex: 1, fontSize: 11, color: "var(--text-secondary)" }}>
      {label}
      <input
        type="number"
        step="0.25"
        min={HOUR_START}
        max={HOUR_END}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={inputStyle({ width: "100%", marginTop: 3 })}
      />
      <span style={{ fontSize: 10.5, color: "var(--text-muted)" }}>{fmtHour(value)}</span>
    </label>
  );
}
