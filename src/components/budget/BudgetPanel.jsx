import { CATEGORIES } from "../../constants/categories";
import { inputStyle } from "../../utils/styles";
import EventEditor from "../editor/EventEditor";

function Row({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, margin: "4px 0", color: "var(--text-secondary)" }}>
      <span>{label}</span>
      <span style={{ fontVariantNumeric: "tabular-nums" }}>{value}</span>
    </div>
  );
}

export default function BudgetPanel({ selectedEvent, onUpdateEvent, onDeleteEvent, extras, cruiseTotal, extrasTotal, grandTotal, pricePerPerson, onUpdateExtra }) {
  return (
    <div style={{ width: 270, flexShrink: 0, display: "flex", flexDirection: "column", gap: 12 }}>
      {/* event editor */}
      <div style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 10, padding: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
          {selectedEvent ? "Editar actividad" : "Selecciona un bloque"}
        </div>
        {selectedEvent ? (
          <EventEditor ev={selectedEvent.ev} onChange={onUpdateEvent} onDelete={onDeleteEvent} />
        ) : (
          <div style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.5 }}>
            Haz clic en cualquier actividad del calendario para cambiar su hora, duración,
            categoría o nota. Arrastra para moverla de hora o de día.
          </div>
        )}
      </div>

      {/* legend */}
      <div style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 10, padding: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Categorías</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          {Object.entries(CATEGORIES).map(([k, c]) => (
            <div key={k} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: c.dot, flexShrink: 0 }} />
              {c.label}
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 10, lineHeight: 1.4 }}>
          La franja azul tenue marca la ventana en que el barco está en puerto.
        </div>
      </div>

      {/* budget */}
      <div style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 10, padding: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Presupuesto</div>
        <Row label={`Crucero · $${pricePerPerson}/pp × 2`} value={`$${cruiseTotal.toLocaleString()}`} />

        {extras.map((x) => (
          <div key={x.id} style={{ display: "flex", alignItems: "center", gap: 6, margin: "7px 0" }}>
            <input
              value={x.label}
              onChange={(e) => onUpdateExtra(x.id, { label: e.target.value })}
              style={inputStyle({ flex: 1, fontSize: 11.5 })}
            />
            <span style={{ fontSize: 11 }}>$</span>
            <input
              type="number"
              value={x.amount}
              onChange={(e) => onUpdateExtra(x.id, { amount: e.target.value })}
              style={inputStyle({ width: 58, fontSize: 11.5, textAlign: "right" })}
            />
          </div>
        ))}

        <div style={{ borderTop: "1px solid var(--border)", marginTop: 8, paddingTop: 8, display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 600 }}>
          <span>Total</span>
          <span>${grandTotal.toLocaleString()} USD</span>
        </div>
      </div>
    </div>
  );
}
