"use client";
import type { Task } from "@/types";

const MAX_SHOW = 5;

export default function TaskPreviewCard({ tasks }: { tasks: Task[] }) {
  const pending = tasks.filter((t) => !t.done);
  const done    = tasks.filter((t) => t.done);

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
