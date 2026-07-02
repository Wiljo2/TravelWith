"use client";
import { useState, useRef, useEffect } from "react";
import type { CSSProperties } from "react";
import type { Task, TaskPriority, Day } from "@/types";
import { TASK_CATEGORIES, DEFAULT_TASK_CAT, PRIORITIES, PRIORITY_ORDER } from "@/constants/taskCategories";
import { fmtHour } from "@/utils/time";

interface TasksViewProps {
  days: Day[];
  tasks: Task[];
  onAdd: (title: string) => void;
  onToggle: (id: string) => void;
  onUpdateTask: (id: string, patch: Partial<Task>) => void;
  onDelete: (id: string) => void;
}

export default function TasksView({ days, tasks, onAdd, onToggle, onUpdateTask, onDelete }: TasksViewProps) {
  const [draft, setDraft] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const pending = tasks.filter((t) => !t.done);
  const done    = tasks.filter((t) => t.done);

  function submit() {
    const title = draft.trim();
    if (!title) return;
    onAdd(title);
    setDraft("");
    inputRef.current?.focus();
  }

  function startEdit(task: Task) {
    setEditingId(task.id);
    setEditValue(task.title);
  }

  function commitEdit(id: string) {
    if (editValue.trim()) onUpdateTask(id, { title: editValue.trim() });
    setEditingId(null);
  }

  const dayLabel = (id?: string) => days.find((d) => d.id === id)?.label.split("·")[0].trim();

  function renderList(list: Task[]) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {list.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            scheduledLabel={task.dayId ? `${dayLabel(task.dayId)} · ${fmtHour(task.start ?? 0)}` : null}
            expanded={expandedId === task.id}
            editing={editingId === task.id}
            editValue={editValue}
            onToggleExpand={() => setExpandedId((p) => p === task.id ? null : task.id)}
            onToggleDone={() => onToggle(task.id)}
            onStartEdit={() => startEdit(task)}
            onEditChange={setEditValue}
            onCommitEdit={() => commitEdit(task.id)}
            onCancelEdit={() => setEditingId(null)}
            onUpdate={(patch) => onUpdateTask(task.id, patch)}
            onDelete={() => onDelete(task.id)}
          />
        ))}
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--surface-1)" }}>
      <div style={{ flex: 1, overflowY: "auto", padding: "24px 0", display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ width: "100%", maxWidth: 640, padding: "0 20px" }}>

          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="Nueva tarea, cosa por decidir..."
              style={{ flex: 1, padding: "10px 14px", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-primary)", fontSize: 14, outline: "none" }}
            />
            <button
              onClick={submit}
              disabled={!draft.trim()}
              style={{ padding: "10px 18px", borderRadius: 8, background: "#6EE7B7", color: "#04342C", border: "none", fontWeight: 600, fontSize: 14, cursor: draft.trim() ? "pointer" : "not-allowed", opacity: draft.trim() ? 1 : 0.4 }}
            >
              Añadir
            </button>
          </div>

          <p style={{ margin: "0 0 24px", fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.5 }}>
            Tip: en el calendario, haz clic en un hueco libre para agendar una tarea o discusión a una hora concreta.
          </p>

          {pending.length > 0 && (
            <section style={{ marginBottom: 32 }}>
              <p style={sectionTitle}>POR HACER · {pending.length}</p>
              {renderList(pending)}
            </section>
          )}

          {done.length > 0 && (
            <section>
              <p style={sectionTitle}>COMPLETADAS · {done.length}</p>
              {renderList(done)}
            </section>
          )}

          {tasks.length === 0 && (
            <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-muted)", fontSize: 14, lineHeight: 1.8 }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>✓</div>
              Sin tareas aún.<br />
              Añade cosas por decidir, confirmar o recordar.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const sectionTitle: CSSProperties = { margin: "0 0 10px", fontSize: 11, fontWeight: 600, letterSpacing: ".07em", color: "var(--text-muted)" };

interface TaskRowProps {
  task: Task;
  scheduledLabel: string | null;
  expanded: boolean;
  editing: boolean;
  editValue: string;
  onToggleExpand: () => void;
  onToggleDone: () => void;
  onStartEdit: () => void;
  onEditChange: (v: string) => void;
  onCommitEdit: () => void;
  onCancelEdit: () => void;
  onUpdate: (patch: Partial<Task>) => void;
  onDelete: () => void;
}

function TaskRow({
  task, scheduledLabel, expanded, editing, editValue,
  onToggleExpand, onToggleDone, onStartEdit,
  onEditChange, onCommitEdit, onCancelEdit, onUpdate, onDelete,
}: TaskRowProps) {
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const c = TASK_CATEGORIES[task.cat ?? DEFAULT_TASK_CAT] ?? TASK_CATEGORIES[DEFAULT_TASK_CAT];
  const pr = task.priority ? PRIORITIES[task.priority] : null;

  useEffect(() => {
    if (expanded && noteRef.current) {
      noteRef.current.style.height = "auto";
      noteRef.current.style.height = noteRef.current.scrollHeight + "px";
    }
  }, [expanded]);

  return (
    <div style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", opacity: task.done ? 0.6 : 1, transition: "opacity .15s" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px" }}>
        <button
          onClick={onToggleDone}
          style={{ width: 20, height: 20, borderRadius: 6, flexShrink: 0, border: `2px solid ${task.done ? "#6EE7B7" : "var(--border)"}`, background: task.done ? "#6EE7B7" : "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          {task.done && (
            <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L4 7L9 1" stroke="#04342C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          )}
        </button>

        {editing ? (
          <input
            autoFocus
            value={editValue}
            onChange={(e) => onEditChange(e.target.value)}
            onBlur={onCommitEdit}
            onKeyDown={(e) => { if (e.key === "Enter") onCommitEdit(); if (e.key === "Escape") onCancelEdit(); }}
            style={{ flex: 1, background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text-primary)", fontSize: 14, padding: "3px 8px", outline: "none" }}
          />
        ) : (
          <span
            onDoubleClick={onStartEdit}
            style={{ flex: 1, fontSize: 14, color: "var(--text-primary)", textDecoration: task.done ? "line-through" : "none", cursor: "text", userSelect: "none", display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}
          >
            <span title={c.label} style={{ flexShrink: 0 }}>{c.icon}</span>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{task.title}</span>
          </span>
        )}

        {scheduledLabel && (
          <span
            onClick={() => onUpdate({ dayId: undefined, start: undefined, end: undefined })}
            title="Clic para quitar del calendario"
            style={{ flexShrink: 0, fontSize: 10, color: c.text, background: c.bg, border: `1px solid ${c.border}44`, borderRadius: 20, padding: "2px 8px", whiteSpace: "nowrap", cursor: "pointer" }}
          >
            📅 {scheduledLabel} ×
          </span>
        )}
        {pr && (
          <span style={{ flexShrink: 0, fontSize: 9.5, fontWeight: 700, color: pr.color, background: pr.bg, borderRadius: 4, padding: "1px 6px" }}>{pr.label}</span>
        )}

        <button
          onClick={onToggleExpand}
          title="Detalle"
          style={{ background: "none", border: "none", color: task.note ? "var(--text-secondary)" : "var(--text-muted)", cursor: "pointer", fontSize: 13, padding: "2px 6px", borderRadius: 4, opacity: expanded || task.note ? 1 : 0.4 }}
        >
          {expanded ? "▴" : "▾"}
        </button>

        <button
          onClick={onDelete}
          style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 16, padding: "2px 4px", borderRadius: 4, opacity: 0.5 }}
          title="Eliminar"
        >
          ×
        </button>
      </div>

      {expanded && (
        <div style={{ padding: "0 14px 14px 44px", display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {Object.entries(TASK_CATEGORIES).map(([key, cc]) => {
              const active = (task.cat ?? DEFAULT_TASK_CAT) === key;
              return (
                <button key={key} onClick={() => onUpdate({ cat: key })}
                  style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 20, fontSize: 11, fontWeight: 500, cursor: "pointer", background: active ? cc.bg : "var(--surface-1)", border: `1.5px solid ${active ? cc.border : "var(--border)"}`, color: active ? cc.text : "var(--text-muted)" }}>
                  <span>{cc.icon}</span>{cc.label}
                </button>
              );
            })}
          </div>

          <div style={{ display: "flex", gap: 5 }}>
            {PRIORITY_ORDER.map((p) => {
              const active = task.priority === p;
              const prp = PRIORITIES[p];
              return (
                <button key={p} onClick={() => onUpdate({ priority: p as TaskPriority })}
                  style={{ padding: "3px 12px", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer", background: active ? prp.bg : "var(--surface-1)", border: `1px solid ${active ? prp.color : "var(--border)"}`, color: active ? prp.color : "var(--text-muted)" }}>
                  {prp.label}
                </button>
              );
            })}
          </div>

          <textarea
            ref={noteRef}
            defaultValue={task.note ?? ""}
            onBlur={(e) => onUpdate({ note: e.target.value })}
            onChange={(e) => { e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; }}
            placeholder="Qué se va a discutir / detalle..."
            rows={2}
            style={{ width: "100%", resize: "none", overflow: "hidden", background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text-secondary)", fontSize: 13, padding: "8px 10px", outline: "none", lineHeight: 1.5, boxSizing: "border-box" }}
          />
        </div>
      )}
    </div>
  );
}
