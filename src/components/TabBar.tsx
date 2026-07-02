export type Tab = "calendar" | "budget" | "tasks";

interface TabBarProps {
  active: Tab;
  onChange: (tab: Tab) => void;
  pendingTaskCount?: number;
}

const TABS: { id: Tab; label: string }[] = [
  { id: "calendar", label: "Actividades" },
  { id: "budget",   label: "Presupuesto" },
  { id: "tasks",    label: "Tareas" },
];

export default function TabBar({ active, onChange, pendingTaskCount }: TabBarProps) {
  return (
    <div style={{
      display: "flex", gap: 0, padding: "0 20px",
      borderBottom: "1px solid var(--border)",
      background: "var(--surface-2)",
    }}>
      {TABS.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "11px 22px",
            border: "none",
            borderBottom: active === t.id ? "2px solid #6EE7B7" : "2px solid transparent",
            background: "none",
            color: active === t.id ? "#6EE7B7" : "var(--text-muted)",
            fontWeight: active === t.id ? 600 : 400,
            cursor: "pointer",
            fontSize: 14,
            transition: "color .15s",
          }}
        >
          {t.label}
          {t.id === "tasks" && pendingTaskCount != null && pendingTaskCount > 0 && (
            <span style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              minWidth: 18, height: 18, padding: "0 5px",
              borderRadius: 9, fontSize: 11, fontWeight: 600,
              background: active === t.id ? "#6EE7B7" : "var(--border)",
              color: active === t.id ? "#04342C" : "var(--text-muted)",
            }}>
              {pendingTaskCount}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
