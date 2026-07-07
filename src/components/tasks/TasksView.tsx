"use client";
import { useState, useRef, useEffect } from "react";
import type { Task, TaskPriority, Day } from "@/types";
import { TASK_CATEGORIES, DEFAULT_TASK_CAT, PRIORITIES, PRIORITY_ORDER } from "@/constants/taskCategories";
import { fmtHour } from "@/utils/time";
import { optionGroupUSD, fmtUSDNum } from "@/utils/currency";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import TaskOptions from "@/components/tasks/TaskOptions";
import NoteLinks from "@/components/NoteLinks";

interface TasksViewProps {
  days: Day[];
  tasks: Task[];
  people: number;
  exchangeRate: number;
  onAdd: (title: string) => void;
  onToggle: (id: string) => void;
  onUpdateTask: (id: string, patch: Partial<Task>) => void;
  onChooseOption: (taskId: string, optionId: string) => void;
  onDelete: (id: string) => void;
}

export default function TasksView({ days, tasks, people, exchangeRate, onAdd, onToggle, onUpdateTask, onChooseOption, onDelete }: TasksViewProps) {
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
      <div className="flex flex-col gap-1.5">
        {list.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            people={people}
            exchangeRate={exchangeRate}
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
            onChoose={(optionId) => onChooseOption(task.id, optionId)}
            onDelete={() => onDelete(task.id)}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-secondary">
      <div className="flex flex-1 flex-col items-center overflow-y-auto py-6">
        <div className="w-full max-w-[640px] px-5">

          <div className="mb-3 flex gap-2">
            <Input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="Nueva tarea, cosa por decidir..."
              className="flex-1 bg-card py-2.5 text-sm"
            />
            <Button onClick={submit} disabled={!draft.trim()} className="font-semibold">
              Añadir
            </Button>
          </div>

          <p className="mb-6 text-[11.5px] leading-normal text-muted-foreground">
            Tip: en el calendario, haz clic en un hueco libre para agendar una tarea o discusión a una hora concreta.
          </p>

          {pending.length > 0 && (
            <section className="mb-8">
              <p className="mb-2.5 text-[11px] font-semibold tracking-[.07em] text-muted-foreground">POR HACER · {pending.length}</p>
              {renderList(pending)}
            </section>
          )}

          {done.length > 0 && (
            <section>
              <p className="mb-2.5 text-[11px] font-semibold tracking-[.07em] text-muted-foreground">COMPLETADAS · {done.length}</p>
              {renderList(done)}
            </section>
          )}

          {tasks.length === 0 && (
            <div className="px-5 py-14 text-center text-sm leading-loose text-muted-foreground">
              <div className="mb-3 text-[32px]">✓</div>
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
  people: number;
  exchangeRate: number;
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
  onChoose: (optionId: string) => void;
  onDelete: () => void;
}

function TaskRow({
  task, people, exchangeRate, scheduledLabel, expanded, editing, editValue,
  onToggleExpand, onToggleDone, onStartEdit,
  onEditChange, onCommitEdit, onCancelEdit, onUpdate, onChoose, onDelete,
}: TaskRowProps) {
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const c = TASK_CATEGORIES[task.cat ?? DEFAULT_TASK_CAT] ?? TASK_CATEGORIES[DEFAULT_TASK_CAT];
  const pr = task.priority ? PRIORITIES[task.priority] : null;
  const options = task.options ?? [];
  const optionRange = options.length > 0
    ? (() => {
        const costs = options.map((o) => optionGroupUSD(o, people, exchangeRate));
        return { low: Math.min(...costs), high: Math.max(...costs) };
      })()
    : null;

  useEffect(() => {
    if (expanded && noteRef.current) {
      noteRef.current.style.height = "auto";
      noteRef.current.style.height = noteRef.current.scrollHeight + "px";
    }
  }, [expanded, task.note]);

  return (
    <div className={cn("overflow-hidden rounded-[10px] border border-border bg-card transition-opacity", task.done && "opacity-60")}>
      <div className="flex items-center gap-2.5 px-3.5 py-3">
        <Checkbox
          checked={task.done}
          onCheckedChange={onToggleDone}
          className="h-5 w-5 rounded-md data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
        />

        {editing ? (
          <Input
            autoFocus
            value={editValue}
            onChange={(e) => onEditChange(e.target.value)}
            onBlur={onCommitEdit}
            onKeyDown={(e) => { if (e.key === "Enter") onCommitEdit(); if (e.key === "Escape") onCancelEdit(); }}
            className="h-auto flex-1 bg-secondary px-2 py-[3px] text-sm"
          />
        ) : (
          <span
            onDoubleClick={onStartEdit}
            className={cn("flex min-w-0 flex-1 cursor-text select-none items-center gap-[7px] text-sm text-foreground", task.done && "line-through")}
          >
            <span title={c.label} className="shrink-0">{c.icon}</span>
            <span className="truncate">{task.title}</span>
          </span>
        )}

        {scheduledLabel && (
          <span
            onClick={() => onUpdate({ dayId: undefined, start: undefined, end: undefined })}
            title="Clic para quitar del calendario"
            className="shrink-0 cursor-pointer whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px]"
            style={{ color: c.text, background: c.bg, borderColor: `${c.border}44` }}
          >
            📅 {scheduledLabel} ×
          </span>
        )}
        {optionRange && (
          <span
            className="shrink-0 whitespace-nowrap rounded-full border border-[#F59E0B55] bg-[#F59E0B18] px-2 py-0.5 text-[9.5px] font-semibold text-[#B45309]"
            title="Decisión pendiente: elige una opción para confirmarla"
          >
            🔀 {options.length} opc · {optionRange.low === optionRange.high
              ? `$${fmtUSDNum(optionRange.low)}`
              : `$${fmtUSDNum(optionRange.low)}–${fmtUSDNum(optionRange.high)}`}
          </span>
        )}
        {pr && (
          <span className="shrink-0 rounded px-1.5 py-px text-[9.5px] font-bold" style={{ color: pr.color, background: pr.bg }}>{pr.label}</span>
        )}

        <button
          onClick={onToggleExpand}
          title="Detalle"
          className={cn(
            "cursor-pointer rounded px-1.5 py-0.5 text-[13px]",
            task.note ? "text-secondary-foreground" : "text-muted-foreground",
            expanded || task.note ? "opacity-100" : "opacity-40",
          )}
        >
          {expanded ? "▴" : "▾"}
        </button>

        <button
          onClick={onDelete}
          className="cursor-pointer rounded px-1 py-0.5 text-base text-muted-foreground opacity-50 hover:opacity-100"
          title="Eliminar"
        >
          ×
        </button>
      </div>

      {expanded && (
        <div className="flex flex-col gap-2.5 pb-3.5 pl-11 pr-3.5">
          <div className="flex flex-wrap gap-[5px]">
            {Object.entries(TASK_CATEGORIES).map(([key, cc]) => {
              const active = (task.cat ?? DEFAULT_TASK_CAT) === key;
              return (
                <button key={key} onClick={() => onUpdate({ cat: key })}
                  className={cn("flex cursor-pointer items-center gap-1 rounded-full border-[1.5px] px-2 py-[3px] text-[11px] font-medium", !active && "border-border bg-secondary text-muted-foreground")}
                  style={active ? { background: cc.bg, borderColor: cc.border, color: cc.text } : undefined}>
                  <span>{cc.icon}</span>{cc.label}
                </button>
              );
            })}
          </div>

          <div className="flex gap-[5px]">
            {PRIORITY_ORDER.map((p) => {
              const active = task.priority === p;
              const prp = PRIORITIES[p];
              return (
                <button key={p} onClick={() => onUpdate({ priority: p as TaskPriority })}
                  className={cn("cursor-pointer rounded-md border px-3 py-[3px] text-[11px] font-semibold", !active && "border-border bg-secondary text-muted-foreground")}
                  style={active ? { background: prp.bg, borderColor: prp.color, color: prp.color } : undefined}>
                  {prp.label}
                </button>
              );
            })}
          </div>

          <textarea
            ref={noteRef}
            value={task.note ?? ""}
            onChange={(e) => {
              onUpdate({ note: e.target.value });
              e.target.style.height = "auto";
              e.target.style.height = e.target.scrollHeight + "px";
            }}
            placeholder="Notas, precios, links… (se guarda solo)"
            rows={2}
            className="box-border w-full resize-none overflow-hidden rounded-md border border-border bg-secondary px-2.5 py-2 text-[13px] leading-normal text-secondary-foreground outline-none"
          />
          <NoteLinks note={task.note} />

          <div className="border-t border-dashed border-border pt-2.5">
            <TaskOptions
              options={options}
              people={people}
              exchangeRate={exchangeRate}
              scheduled={!!task.dayId && task.start != null}
              onChange={(next) => onUpdate({ options: next })}
              onChoose={onChoose}
            />
          </div>
        </div>
      )}
    </div>
  );
}
