"use client";
import { cn } from "@/lib/utils";
import type { Task } from "@/types";

export function DaySpanChips({ chips }: { chips: { label: string; color: string }[] }) {
  if (chips.length === 0) return null;
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {chips.map((c) => (
        <span key={c.label} className="flex items-center gap-1.5 rounded-full bg-secondary px-2 py-0.5 text-[11px] text-secondary-foreground ring-1 ring-border">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: c.color }} />
          {c.label}
        </span>
      ))}
    </div>
  );
}

// A scheduled task's done box, in its category color.
export function TaskCheck({ task, color, onToggle, className }: { task: Task; color: string; onToggle: () => void; className?: string }) {
  return (
    <button
      onClick={onToggle}
      aria-label={task.done ? "Marcar pendiente" : "Marcar hecha"}
      className={cn("flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded border-2", className)}
      style={{ borderColor: color, background: task.done ? color : "transparent" }}
    >
      {task.done && (
        <svg width="9" height="7" viewBox="0 0 10 8" fill="none"><path d="M1 4L4 7L9 1" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
      )}
    </button>
  );
}
