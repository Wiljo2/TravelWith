"use client";
import type { Task } from "@/types";
import { TASK_CATEGORIES, DEFAULT_TASK_CAT, PRIORITIES } from "@/constants/taskCategories";
import { HOUR_START, PX_PER_HOUR } from "@/constants/time";
import { fmtHour } from "@/utils/time";

interface TaskBlockProps {
  task: Task;
  onToggle: () => void;
  onEdit: (x: number, y: number) => void;
}

export default function TaskBlock({ task, onToggle, onEdit }: TaskBlockProps) {
  const c = TASK_CATEGORIES[task.cat ?? DEFAULT_TASK_CAT] ?? TASK_CATEGORIES[DEFAULT_TASK_CAT];
  const start = task.start ?? HOUR_START;
  const end = task.end ?? start + 1;
  const top = (start - HOUR_START) * PX_PER_HOUR;
  const height = Math.max((end - start) * PX_PER_HOUR, 24);
  const pr = task.priority ? PRIORITIES[task.priority] : null;

  return (
    <div
      onClick={(e) => { e.stopPropagation(); onEdit(e.clientX, e.clientY); }}
      style={{
        position: "absolute", top, left: "7.5%", width: "85%", height,
        background: task.done ? "var(--surface-1)" : c.bg,
        border: `1px dashed ${c.border}`,
        borderRadius: 7, padding: "3px 7px", overflow: "hidden", cursor: "pointer",
        opacity: task.done ? 0.55 : 1, boxSizing: "border-box",
      }}
      title="Clic para editar"
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          style={{
            width: 15, height: 15, borderRadius: 4, flexShrink: 0, marginTop: 1,
            border: `2px solid ${c.border}`,
            background: task.done ? c.border : "transparent",
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0,
          }}
        >
          {task.done && (
            <svg width="9" height="7" viewBox="0 0 10 8" fill="none"><path d="M1 4L4 7L9 1" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          )}
        </button>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{
            fontSize: 11.5, fontWeight: 500, color: c.text, lineHeight: 1.2,
            textDecoration: task.done ? "line-through" : "none",
            whiteSpace: height < 38 ? "nowrap" : "normal", overflow: "hidden", textOverflow: "ellipsis",
          }}>
            <span style={{ marginRight: 3 }}>{c.icon}</span>{task.title}
          </div>
          {height >= 38 && (
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 2 }}>
              <span style={{ fontSize: 9.5, color: c.border, fontVariantNumeric: "tabular-nums" }}>{fmtHour(start)}</span>
              {pr && <span style={{ fontSize: 9, fontWeight: 700, color: pr.color, background: pr.bg, borderRadius: 4, padding: "0 4px" }}>{pr.label}</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
