"use client";
import { CATEGORIES } from "@/constants/categories";
import { fmtHour } from "@/utils/time";
import { eventIcon } from "@/utils/itemIcon";
import { cn } from "@/lib/utils";
import type { CalendarEvent, Task } from "@/types";

// A phone Agenda activity line: hours, category dot, title and note.
export function EventRowBody({ ev, tips }: { ev: CalendarEvent; tips?: number }) {
  const cat = CATEGORIES[ev.cat] ?? CATEGORIES.logist;
  return (
    <>
      <span className="w-[68px] shrink-0 pt-px tabular-nums">
        <span className="block text-[13px] text-foreground">{fmtHour(ev.start)}</span>
        {ev.end > ev.start && <span className="block text-[11px] text-muted-foreground">{fmtHour(ev.end)}</span>}
      </span>
      <span className="mt-[7px] h-2 w-2 shrink-0 rounded-full" style={{ background: cat.dot }} />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium leading-snug text-foreground"><span aria-hidden className="mr-1">{eventIcon(ev)}</span>{ev.title}{!!tips && <span className="ml-1.5 text-xs font-semibold text-muted-foreground">💡{tips}</span>}</span>
        {ev.note && <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{ev.note}</span>}
      </span>
    </>
  );
}

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
