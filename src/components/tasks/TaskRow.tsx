"use client";
import { useRef, useEffect } from "react";
import type { Task, TaskPriority } from "@/types";
import { TASK_CATEGORIES, DEFAULT_TASK_CAT, PRIORITIES, PRIORITY_ORDER } from "@/constants/taskCategories";
import { taskIcon } from "@/utils/itemIcon";
import { optionGroupUSD, fmtUSDNum } from "@/utils/currency";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import TaskOptions from "@/components/tasks/TaskOptions";
import type { OptionVoting } from "@/components/tasks/OptionVote";
import NoteLinks from "@/components/NoteLinks";
import IconPicker from "@/components/IconPicker";
import { LIMITS } from "@/constants/limits";
import { useIsTouch } from "@/hooks/useMediaQuery";
import { totalVotes } from "@/utils/votes";

interface TaskRowProps {
  task: Task;
  people: number;
  exchangeRate: number;
  scheduledLabel: string | null;
  expanded: boolean;
  editing: boolean;
  editValue: string;
  voting: OptionVoting;
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

export default function TaskRow({
  task, people, exchangeRate, scheduledLabel, expanded, editing, editValue, voting,
  onToggleExpand, onToggleDone, onStartEdit,
  onEditChange, onCommitEdit, onCancelEdit, onUpdate, onChoose, onDelete,
}: TaskRowProps) {
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const touch = useIsTouch();
  const c = TASK_CATEGORIES[task.cat ?? DEFAULT_TASK_CAT] ?? TASK_CATEGORIES[DEFAULT_TASK_CAT];
  const pr = task.priority ? PRIORITIES[task.priority] : null;
  const options = task.options ?? [];
  const optionRange = options.length > 0
    ? (() => {
        const costs = options.map((o) => optionGroupUSD(o, people, exchangeRate));
        return { low: Math.min(...costs), high: Math.max(...costs) };
      })()
    : null;
  const votes = totalVotes(options, voting.members.map((m) => m.userId));

  useEffect(() => {
    if (expanded && noteRef.current) {
      noteRef.current.style.height = "auto";
      noteRef.current.style.height = noteRef.current.scrollHeight + "px";
    }
  }, [expanded, task.note]);

  return (
    <div className={cn("overflow-hidden rounded-2xl bg-card shadow-[0_1px_2px_rgba(0,0,0,.04)] ring-1 ring-border/70 transition-opacity", task.done && "opacity-60")}>
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 px-3.5 py-3">
        <Checkbox
          checked={task.done}
          onCheckedChange={onToggleDone}
          className="h-5 w-5 rounded-md data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
        />

        {editing ? (
          <Input
            autoFocus
            value={editValue}
            maxLength={LIMITS.title}
            onChange={(e) => onEditChange(e.target.value)}
            onBlur={onCommitEdit}
            onKeyDown={(e) => { if (e.key === "Enter") onCommitEdit(); if (e.key === "Escape") onCancelEdit(); }}
            className="h-auto flex-1 bg-secondary px-2 py-[3px] text-sm"
          />
        ) : (
          <span
            onDoubleClick={onStartEdit}
            onClick={touch ? onStartEdit : undefined}
            className={cn("flex min-w-0 flex-1 cursor-text select-none items-center gap-[7px] text-sm text-foreground", task.done && "line-through")}
          >
            <span title={c.label} className="shrink-0">{taskIcon(task)}</span>
            <span className="truncate">{task.title}</span>
          </span>
        )}

        {(scheduledLabel || optionRange || pr) && (
        <div className="flex shrink-0 flex-wrap items-center gap-1.5 max-md:order-last max-md:w-full max-md:pl-[30px]">
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
            🔀 {options.length} opc{votes > 0 && ` · ✋ ${votes}`} · {optionRange.low === optionRange.high
              ? fmtUSDNum(optionRange.low)
              : `${fmtUSDNum(optionRange.low)}–${fmtUSDNum(optionRange.high)}`}
          </span>
        )}
        {pr && (
          <span className="shrink-0 rounded px-1.5 py-px text-[9.5px] font-bold" style={{ color: pr.color, background: pr.bg }}>{pr.label}</span>
        )}
        </div>
        )}

        <button
          onClick={onToggleExpand}
          title="Detalle"
          className={cn(
            "flex cursor-pointer items-center justify-center rounded px-1.5 py-0.5 text-[13px] max-md:h-9 max-md:w-8",
            task.note ? "text-secondary-foreground" : "text-muted-foreground",
            expanded || task.note ? "opacity-100" : "opacity-40",
          )}
        >
          {expanded ? "▴" : "▾"}
        </button>

        <button
          onClick={onDelete}
          className="flex cursor-pointer items-center justify-center rounded px-1 py-0.5 text-base text-muted-foreground opacity-50 hover:opacity-100 max-md:h-9 max-md:w-8"
          title="Eliminar"
        >
          ×
        </button>
      </div>

      {expanded && (
        <div className="flex flex-col gap-2.5 pb-3.5 pl-3.5 pr-3.5 md:pl-11">
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

          <div className="flex items-start gap-2">
            <span className="pt-3 text-xs text-secondary-foreground">Ícono</span>
            <IconPicker
              value={task.icon}
              title={task.title}
              fallback={(TASK_CATEGORIES[task.cat ?? DEFAULT_TASK_CAT] ?? TASK_CATEGORIES[DEFAULT_TASK_CAT]).icon}
              onChange={(icon) => onUpdate({ icon })}
            />
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
            maxLength={LIMITS.note}
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
              closed={task.done}
              voting={voting}
              onChange={(next) => onUpdate({ options: next })}
              onChoose={onChoose}
            />
          </div>
        </div>
      )}
    </div>
  );
}
