"use client";
import type { Task } from "@/types";
import { TASK_CATEGORIES, DEFAULT_TASK_CAT, PRIORITIES } from "@/constants/taskCategories";
import { PX_PER_HOUR } from "@/constants/time";
import { useGridStart } from "./gridStart";
import { fmtHour } from "@/utils/time";
import { taskIcon } from "@/utils/itemIcon";
import { cn } from "@/lib/utils";

interface TaskBlockProps {
  task: Task;
  onToggle: () => void;
  onEdit: (x: number, y: number) => void;
}

export default function TaskBlock({ task, onToggle, onEdit }: TaskBlockProps) {
  const c = TASK_CATEGORIES[task.cat ?? DEFAULT_TASK_CAT] ?? TASK_CATEGORIES[DEFAULT_TASK_CAT];
  const gridStart = useGridStart();
  const start = task.start ?? gridStart;
  const end = task.end ?? start + 1;
  const top = (start - gridStart) * PX_PER_HOUR;
  const height = Math.max((end - start) * PX_PER_HOUR, 24);
  const pr = task.priority ? PRIORITIES[task.priority] : null;

  return (
    <div
      onClick={(e) => { e.stopPropagation(); onEdit(e.clientX, e.clientY); }}
      className={cn("absolute left-[7.5%] box-border w-[85%] cursor-pointer overflow-hidden rounded-[7px] px-[7px] py-[3px]", task.done && "opacity-55")}
      style={{
        top, height,
        background: task.done ? "var(--secondary)" : c.bg,
        border: `1px dashed ${c.border}`,
      }}
      title="Clic para editar"
    >
      <div className="flex items-start gap-1.5">
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          className="mt-px flex h-[15px] w-[15px] shrink-0 cursor-pointer items-center justify-center rounded p-0"
          style={{
            border: `2px solid ${c.border}`,
            background: task.done ? c.border : "transparent",
          }}
        >
          {task.done && (
            <svg width="9" height="7" viewBox="0 0 10 8" fill="none"><path d="M1 4L4 7L9 1" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          )}
        </button>
        <div className="min-w-0 flex-1">
          <div
            className={cn(
              "overflow-hidden text-ellipsis text-[11.5px] font-medium leading-tight",
              task.done && "line-through",
              height < 38 ? "whitespace-nowrap" : "whitespace-normal",
            )}
            style={{ color: c.text }}
          >
            <span aria-hidden className="mr-[3px]">{taskIcon(task)}</span>{task.title}
          </div>
          {height >= 38 && (
            <div className="mt-0.5 flex items-center gap-1.5">
              <span className="text-[9.5px] tabular-nums" style={{ color: c.border }}>{fmtHour(start)}</span>
              {pr && <span className="rounded px-1 text-[9px] font-bold" style={{ color: pr.color, background: pr.bg }}>{pr.label}</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
