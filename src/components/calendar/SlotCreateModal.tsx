"use client";
import { useState } from "react";
import type { CSSProperties } from "react";
import type { Task, TaskPriority } from "@/types";
import { TASK_CATEGORIES, DEFAULT_TASK_CAT, PRIORITIES, PRIORITY_ORDER } from "@/constants/taskCategories";
import { CATEGORIES } from "@/constants/categories";
import { fmtHour } from "@/utils/time";
import { HOUR_END } from "@/constants/time";

const DURATIONS = [0.5, 1, 2, 3] as const;
const CAT_KEYS = Object.keys(CATEGORIES);

interface SlotCreateModalProps {
  x: number;
  y: number;
  dayLabel: string;
  hour: number;
  existing?: Task | null;
  onSaveActivity: (fields: { title: string; note: string; cat: string; start: number; end: number }) => void;
  onSaveTask: (patch: Partial<Task>) => void;
  onDeleteTask?: () => void;
  onClose: () => void;
}

export default function SlotCreateModal({
  x, y, dayLabel, hour, existing,
  onSaveActivity, onSaveTask, onDeleteTask, onClose,
}: SlotCreateModalProps) {
  const editing = !!existing;
  const startHour = existing?.start ?? hour;
  const [tab, setTab] = useState<"activity" | "task">(editing ? "task" : "activity");

  const [title, setTitle]       = useState(existing?.title ?? "");
  const [note, setNote]         = useState(existing?.note ?? "");
  const [dur, setDur]           = useState<number>(existing?.end && existing?.start ? existing.end - existing.start : 1);
  const [actCat, setActCat]     = useState<string>("miami");
  const [taskCat, setTaskCat]   = useState<string>(existing?.cat ?? DEFAULT_TASK_CAT);
  const [priority, setPriority] = useState<TaskPriority>(existing?.priority ?? "media");

  const canSave = title.trim().length > 0;

  function save() {
    if (!canSave) return;
    const start = startHour;
    const end = Math.min(start + dur, HOUR_END);
    if (tab === "activity") onSaveActivity({ title: title.trim(), note: note.trim(), cat: actCat, start, end });
    else onSaveTask({ title: title.trim(), note: note.trim(), cat: taskCat, priority, start, end });
  }

  const W = 288;
  const left = typeof window !== "undefined" ? Math.min(x, window.innerWidth - W - 12) : x;
  const top  = typeof window !== "undefined" ? Math.min(y, window.innerHeight - 440) : y;

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 40 }} />

      <div
        style={{
          position: "fixed", left: Math.max(12, left), top: Math.max(12, top), width: W, zIndex: 41,
          background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 12,
          boxShadow: "0 12px 40px rgba(0,0,0,.28)", padding: 14,
          display: "flex", flexDirection: "column", gap: 10,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
            <strong style={{ color: "var(--text-secondary)" }}>{dayLabel}</strong> · {fmtHour(startHour)}
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 16, lineHeight: 1, padding: 0 }}>×</button>
        </div>

        {!editing && (
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => setTab("activity")} style={typeBtn(tab === "activity")}>
              <span style={{ fontSize: 13 }}>📌</span> Actividad
            </button>
            <button onClick={() => setTab("task")} style={typeBtn(tab === "task")}>
              <span style={{ fontSize: 13 }}>💬</span> Tarea
            </button>
          </div>
        )}

        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) save(); if (e.key === "Escape") onClose(); }}
          placeholder={tab === "activity" ? "Nombre de la actividad" : "¿Qué hay que hablar? (ej. ¿Excursión?)"}
          style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--surface-1)", color: "var(--text-primary)", fontSize: 13, outline: "none" }}
        />

        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={tab === "activity" ? "Nota…" : "Qué se va a discutir / decidir…"}
          rows={2}
          style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--surface-1)", color: "var(--text-secondary)", fontSize: 12, outline: "none", resize: "vertical", lineHeight: 1.4 }}
        />

        <div>
          <div style={labelStyle}>CATEGORÍA</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {tab === "activity"
              ? CAT_KEYS.map((key) => {
                  const c = CATEGORIES[key];
                  const active = actCat === key;
                  return (
                    <button key={key} onClick={() => setActCat(key)} style={chip(active, c.bg, c.border, c.text)}>
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: c.dot, flexShrink: 0 }} />{c.label}
                    </button>
                  );
                })
              : Object.entries(TASK_CATEGORIES).map(([key, c]) => {
                  const active = taskCat === key;
                  return (
                    <button key={key} onClick={() => setTaskCat(key)} style={chip(active, c.bg, c.border, c.text)}>
                      <span>{c.icon}</span>{c.label}
                    </button>
                  );
                })}
          </div>
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          {tab === "task" && (
            <div style={{ flex: 1 }}>
              <div style={labelStyle}>PRIORIDAD</div>
              <div style={{ display: "flex", gap: 4 }}>
                {PRIORITY_ORDER.map((p) => {
                  const active = priority === p;
                  const pr = PRIORITIES[p];
                  return (
                    <button key={p} onClick={() => setPriority(p)}
                      style={{ flex: 1, padding: "4px 0", borderRadius: 6, fontSize: 10.5, fontWeight: 600, cursor: "pointer", background: active ? pr.bg : "var(--surface-1)", border: `1px solid ${active ? pr.color : "var(--border)"}`, color: active ? pr.color : "var(--text-muted)" }}>
                      {pr.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div style={{ width: tab === "task" ? 116 : "100%" }}>
            <div style={labelStyle}>DURACIÓN</div>
            <div style={{ display: "flex", gap: 4 }}>
              {DURATIONS.map((d) => {
                const active = dur === d;
                return (
                  <button key={d} onClick={() => setDur(d)}
                    style={{ flex: 1, padding: "4px 0", borderRadius: 6, fontSize: 10.5, fontWeight: 600, cursor: "pointer", background: active ? "#6EE7B733" : "var(--surface-1)", border: `1px solid ${active ? "#6EE7B7" : "var(--border)"}`, color: active ? "var(--text-primary)" : "var(--text-muted)" }}>
                    {d === 0.5 ? "30m" : `${d}h`}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
          <button onClick={save} disabled={!canSave}
            style={{ flex: 1, padding: "8px", borderRadius: 7, border: "none", background: canSave ? "#6EE7B7" : "var(--border)", color: canSave ? "#04342C" : "var(--text-muted)", fontWeight: 700, cursor: canSave ? "pointer" : "default", fontSize: 13 }}>
            {editing ? "✓ Guardar cambios" : tab === "activity" ? "✓ Agregar actividad" : "✓ Agregar tarea"}
          </button>
          {editing && onDeleteTask && (
            <button onClick={onDeleteTask}
              style={{ padding: "8px 12px", borderRadius: 7, border: "1px solid #F09595", background: "#FCEBEB", color: "#A32D2D", cursor: "pointer", fontSize: 13, fontWeight: 500 }}>
              Eliminar
            </button>
          )}
        </div>

        {tab === "activity" && !editing && (
          <div style={{ fontSize: 10, color: "var(--text-muted)", textAlign: "center", lineHeight: 1.4 }}>
            Al guardar podrás ajustar horas, rangos y gastos en el panel.
          </div>
        )}
      </div>
    </>
  );
}

const labelStyle: CSSProperties = { fontSize: 10, fontWeight: 600, color: "var(--text-muted)", letterSpacing: ".06em", marginBottom: 6 };

function chip(active: boolean, bg: string, border: string, text: string): CSSProperties {
  return {
    display: "flex", alignItems: "center", gap: 4, padding: "4px 9px", borderRadius: 20,
    fontSize: 11, fontWeight: 500, cursor: "pointer",
    background: active ? bg : "var(--surface-1)",
    border: `1.5px solid ${active ? border : "var(--border)"}`,
    color: active ? text : "var(--text-muted)",
    boxShadow: active ? `0 0 0 2px ${border}33` : "none",
  };
}

function typeBtn(active: boolean): CSSProperties {
  return {
    flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
    padding: "7px 0", borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: "pointer",
    background: active ? "#6EE7B7" : "var(--surface-1)",
    border: `1px solid ${active ? "#6EE7B7" : "var(--border)"}`,
    color: active ? "#04342C" : "var(--text-muted)",
  };
}
