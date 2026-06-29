export default function PriceChip({ label, value, sub, accent, strong }) {
  return (
    <div
      style={{
        background: strong ? "#26215C" : accent ? "#E1F5EE" : "var(--surface-2)",
        border: `1px solid ${strong ? "#26215C" : accent ? "#0F6E56" : "var(--border)"}`,
        borderRadius: 10,
        padding: "8px 14px",
        minWidth: 110,
      }}
    >
      <div style={{ fontSize: 10.5, color: strong ? "#CECBF6" : accent ? "#0F6E56" : "var(--text-secondary)", fontWeight: 500 }}>
        {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 600, color: strong ? "#fff" : accent ? "#04342C" : "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 10, color: strong ? "#AFA9EC" : "var(--text-muted)" }}>
          {sub}
        </div>
      )}
    </div>
  );
}
