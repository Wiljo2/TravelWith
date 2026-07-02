"use client";
import { useState, useRef, useEffect } from "react";
import type { Task } from "../../types";

interface TasksViewProps {
  tasks: Task[];
  onAdd: (title: string) => void;
  onToggle: (id: string) => void;
  onUpdateTitle: (id: string, title: string) => void;
  onUpdateNote: (id: string, note: string) => void;
  onDelete: (id: string) => void;
}

export default function TasksView({
  tasks,
  onAdd,
  onToggle,
  onUpdateTitle,
  onUpdateNote,
  onDelete,
}: TasksViewProps) {
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
    if (editValue.trim()) onUpdateTitle(id, editValue.trim());
    setEditingId(null);
  }

  return (
    <div style={{
      flex: 1, display: "flex", flexDirection: "column",
      overflow: "hidden", background: "var(--surface-1)",
    }}>
      <div style={{
        flex: 1, overflowY: "auto",
        padding: "24px 0",
        display: "flex", flexDirection: "column", alignItems: "center",
      }}>
        <div style={{ width: "100%", maxWidth: 640, padding: "0 20px" }}>

          {/* Add task input */}
          <div style={{
            display: "flex", gap: 8, marginBottom: 28,
          }}>
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="Nueva tarea, cosa por decidir..."
              style={{
                flex: 1, padding: "10px 14px",
                background: "var(--surface-2)", border: "1px solid var(--border)",
                borderRadius: 8, color: "var(--text-primary)", fontSize: 14,
                outline: "none",
              }}
            />
            <button
              onClick={submit}
              disabled={!draft.trim()}
              style={{
                padding: "10px 18px", borderRadius: 8,
                background: "#6EE7B7", color: "#04342C",
                border: "none", fontWeight: 600, fontSize: 14,
                cursor: draft.trim() ? "pointer" : "not-allowed",
                opacity: draft.trim() ? 1 : 0.4,
              }}
            >
              Añadir
            </button>
          </div>

          {/* Pending tasks */}
          {pending.length > 0 && (
            <section style={{ marginBottom: 32 }}>
              <p style={{
                margin: "0 0 10px",
                fontSize: 11, fontWeight: 600, letterSpacing: ".07em",
                color: "var(--text-muted)",
              }}>
                POR HACER · {pending.length}
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {pending.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    expanded={expandedId === task.id}
                    editing={editingId === task.id}
                    editValue={editValue}
                    onToggleExpand={() => setExpandedId((p) => p === task.id ? null : task.id)}
                    onToggleDone={() => onToggle(task.id)}
                    onStartEdit={() => startEdit(task)}
                    onEditChange={setEditValue}
                    onCommitEdit={() => commitEdit(task.id)}
                    onCancelEdit={() => setEditingId(null)}
                    onUpdateNote={(note) => onUpdateNote(task.id, note)}
                    onDelete={() => onDelete(task.id)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Done tasks */}
          {done.length > 0 && (
            <section>
              <p style={{
                margin: "0 0 10px",
                fontSize: 11, fontWeight: 600, letterSpacing: ".07em",
                color: "var(--text-muted)",
              }}>
                COMPLETADAS · {done.length}
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {done.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    expanded={expandedId === task.id}
                    editing={editingId === task.id}
                    editValue={editValue}
                    onToggleExpand={() => setExpandedId((p) => p === task.id ? null : task.id)}
                    onToggleDone={() => onToggle(task.id)}
                    onStartEdit={() => startEdit(task)}
                    onEditChange={setEditValue}
                    onCommitEdit={() => commitEdit(task.id)}
                    onCancelEdit={() => setEditingId(null)}
                    onUpdateNote={(note) => onUpdateNote(task.id, note)}
                    onDelete={() => onDelete(task.id)}
                  />
                ))}
              </div>
            </section>
          )}

          {tasks.length === 0 && (
            <div style={{
              textAlign: "center", padding: "60px 20px",
              color: "var(--text-muted)", fontSize: 14, lineHeight: 1.8,
            }}>
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

interface TaskRowProps {
  task: Task;
  expanded: boolean;
  editing: boolean;
  editValue: string;
  onToggleExpand: () => void;
  onToggleDone: () => void;
  onStartEdit: () => void;
  onEditChange: (v: string) => void;
  onCommitEdit: () => void;
  onCancelEdit: () => void;
  onUpdateNote: (note: string) => void;
  onDelete: () => void;
}

function TaskRow({
  task, expanded, editing, editValue,
  onToggleExpand, onToggleDone, onStartEdit,
  onEditChange, onCommitEdit, onCancelEdit,
  onUpdateNote, onDelete,
}: TaskRowProps) {
  const noteRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (expanded && noteRef.current) {
      noteRef.current.style.height = "auto";
      noteRef.current.style.height = noteRef.current.scrollHeight + "px";
    }
  }, [expanded]);

  return (
    <div style={{
      background: "var(--surface-2)", border: "1px solid var(--border)",
      borderRadius: 10, overflow: "hidden",
      opacity: task.done ? 0.6 : 1,
      transition: "opacity .15s",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px" }}>
        {/* Checkbox */}
        <button
          onClick={onToggleDone}
          style={{
            width: 20, height: 20, borderRadius: 6, flexShrink: 0,
            border: `2px solid ${task.done ? "#6EE7B7" : "var(--border)"}`,
            background: task.done ? "#6EE7B7" : "transparent",
            cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          {task.done && (
            <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
              <path d="M1 4L4 7L9 1" stroke="#04342C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </button>

        {/* Title */}
        {editing ? (
          <input
            autoFocus
            value={editValue}
            onChange={(e) => onEditChange(e.target.value)}
            onBlur={onCommitEdit}
            onKeyDown={(e) => {
              if (e.key === "Enter") onCommitEdit();
              if (e.key === "Escape") onCancelEdit();
            }}
            style={{
              flex: 1, background: "var(--surface-1)",
              border: "1px solid var(--border)", borderRadius: 6,
              color: "var(--text-primary)", fontSize: 14,
              padding: "3px 8px", outline: "none",
            }}
          />
        ) : (
          <span
            onDoubleClick={onStartEdit}
            style={{
              flex: 1, fontSize: 14, color: "var(--text-primary)",
              textDecoration: task.done ? "line-through" : "none",
              cursor: "text", userSelect: "none",
            }}
          >
            {task.title}
          </span>
        )}

        {/* Note indicator + expand */}
        <button
          onClick={onToggleExpand}
          title="Nota"
          style={{
            background: "none", border: "none",
            color: task.note ? "var(--text-secondary)" : "var(--text-muted)",
            cursor: "pointer", fontSize: 13, padding: "2px 6px", borderRadius: 4,
            opacity: expanded || task.note ? 1 : 0.4,
          }}
        >
          {expanded ? "▴" : "▾"}
        </button>

        {/* Delete */}
        <button
          onClick={onDelete}
          style={{
            background: "none", border: "none",
            color: "var(--text-muted)", cursor: "pointer",
            fontSize: 16, padding: "2px 4px", borderRadius: 4,
            opacity: 0.5,
          }}
          title="Eliminar"
        >
          ×
        </button>
      </div>

      {/* Expandable note */}
      {expanded && (
        <div style={{ padding: "0 14px 12px 44px" }}>
          <textarea
            ref={noteRef}
            defaultValue={task.note ?? ""}
            onBlur={(e) => onUpdateNote(e.target.value)}
            onChange={(e) => {
              e.target.style.height = "auto";
              e.target.style.height = e.target.scrollHeight + "px";
            }}
            placeholder="Añadir nota o detalle..."
            rows={2}
            style={{
              width: "100%", resize: "none", overflow: "hidden",
              background: "var(--surface-1)", border: "1px solid var(--border)",
              borderRadius: 6, color: "var(--text-secondary)", fontSize: 13,
              padding: "8px 10px", outline: "none", lineHeight: 1.5,
              boxSizing: "border-box",
            }}
          />
        </div>
      )}
    </div>
  );
}
