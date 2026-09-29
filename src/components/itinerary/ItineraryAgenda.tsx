"use client";
import { useEffect, useRef } from "react";
import { Plus } from "lucide-react";
import { CATEGORIES } from "@/constants/categories";
import { TASK_CATEGORIES, DEFAULT_TASK_CAT } from "@/constants/taskCategories";
import { fmtHour } from "@/utils/time";
import { nextFreeHour } from "@/utils/tripDays";
import { daySpanLabels } from "@/utils/spans";
import { PANEL } from "@/components/home/shared";
import { cn } from "@/lib/utils";
import type { CalendarEvent, Day, Task, TripSpan } from "@/types";

interface ItineraryAgendaProps {
  days: Day[];
  tripSpans: TripSpan[];
  tasks: Task[];
  selectedId: string | null;
  todayIdx?: number;
  onSelect: (id: string) => void;
  onAdd: (dayId: string, hour: number, x: number, y: number) => void;
  onEditTask: (task: Task, x: number, y: number) => void;
  onToggleTask: (id: string) => void;
}

type Row = { kind: "event"; ev: CalendarEvent; start: number } | { kind: "task"; task: Task; start: number };

// The whole trip as a list of day cards — the default, low-noise itinerary view.
export default function ItineraryAgenda({
  days, tripSpans, tasks, selectedId, todayIdx, onSelect, onAdd, onEditTask, onToggleTask,
}: ItineraryAgendaProps) {
  const todayRef = useRef<HTMLElement>(null);
  useEffect(() => {
    todayRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, []);

  return (
    <div className="flex flex-col gap-4">
      {days.map((day, i) => {
        const [weekday, date] = day.label.split("·").map((s) => s.trim());
        const isToday = i === todayIdx;
        const chips = daySpanLabels(day, days, tripSpans);
        const rows: Row[] = [
          ...day.events.map((ev) => ({ kind: "event" as const, ev, start: ev.start })),
          ...tasks
            .filter((t) => t.dayId === day.id && t.start != null)
            .map((task) => ({ kind: "task" as const, task, start: task.start! })),
        ].sort((a, b) => a.start - b.start);

        return (
          <section
            key={day.id}
            ref={isToday ? todayRef : undefined}
            className={cn(PANEL, "scroll-mt-4", isToday && "ring-2 ring-primary")}
          >
            <div className="mb-2 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="flex items-center gap-2 text-[15px] font-semibold">
                  {weekday} {date}
                  {isToday && <span className="rounded-full bg-primary px-2 py-px text-[11px] font-semibold text-primary-foreground">Hoy</span>}
                </h3>
                {day.sub && <p className="truncate text-[13px] text-muted-foreground">{day.sub}</p>}
                {chips.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {chips.map((c) => (
                      <span key={c.label} className="flex items-center gap-1.5 rounded-full bg-secondary px-2 py-0.5 text-[11px] text-secondary-foreground ring-1 ring-border">
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: c.color }} />
                        {c.label}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={(e) => onAdd(day.id, nextFreeHour(day), e.clientX, e.clientY)}
                className="flex shrink-0 cursor-pointer items-center gap-1 rounded-full px-2.5 py-1.5 text-[13px] font-medium text-emerald-700 hover:bg-accent"
              >
                <Plus className="size-4" />
                <span className="hidden sm:inline">Actividad</span>
              </button>
            </div>

            {rows.length === 0 ? (
              <p className="py-1 text-[13px] text-muted-foreground">Día libre, sin actividades aún.</p>
            ) : (
              <ul className="-mx-2 flex flex-col">
                {rows.map((r) =>
                  r.kind === "event"
                    ? <EventRow key={r.ev.id} ev={r.ev} selected={r.ev.id === selectedId} onClick={() => onSelect(r.ev.id)} />
                    : <TaskRow key={r.task.id} task={r.task} onEdit={onEditTask} onToggle={() => onToggleTask(r.task.id)} />,
                )}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

function EventRow({ ev, selected, onClick }: { ev: CalendarEvent; selected: boolean; onClick: () => void }) {
  const cat = CATEGORIES[ev.cat] ?? CATEGORIES.logist;
  return (
    <li>
      <button
        onClick={onClick}
        className={cn(
          "flex w-full cursor-pointer items-start gap-3 rounded-lg px-2 py-2 text-left transition-colors",
          selected ? "bg-accent" : "hover:bg-secondary",
        )}
      >
        <span className="w-[68px] shrink-0 pt-px tabular-nums">
          <span className="block text-[13px] text-foreground">{fmtHour(ev.start)}</span>
          {ev.end > ev.start && <span className="block text-[11px] text-muted-foreground">{fmtHour(ev.end)}</span>}
        </span>
        <span className="mt-[7px] h-2 w-2 shrink-0 rounded-full" style={{ background: cat.dot }} />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium leading-snug text-foreground">{ev.title}</span>
          {ev.note && <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{ev.note}</span>}
        </span>
      </button>
    </li>
  );
}

function TaskRow({ task, onEdit, onToggle }: { task: Task; onEdit: (t: Task, x: number, y: number) => void; onToggle: () => void }) {
  const cat = TASK_CATEGORIES[task.cat ?? DEFAULT_TASK_CAT] ?? TASK_CATEGORIES[DEFAULT_TASK_CAT];
  return (
    <li className="flex items-start gap-3 rounded-lg px-2 py-2 hover:bg-secondary">
      <span className="w-[68px] shrink-0 pt-px text-[13px] tabular-nums text-muted-foreground">{fmtHour(task.start ?? 0)}</span>
      <button
        onClick={onToggle}
        aria-label={task.done ? "Marcar pendiente" : "Marcar hecha"}
        className="mt-0.5 flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded border-2"
        style={{ borderColor: cat.border, background: task.done ? cat.border : "transparent" }}
      >
        {task.done && (
          <svg width="9" height="7" viewBox="0 0 10 8" fill="none"><path d="M1 4L4 7L9 1" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        )}
      </button>
      <button onClick={(e) => onEdit(task, e.clientX, e.clientY)} className="min-w-0 flex-1 cursor-pointer text-left">
        <span className={cn("block text-sm leading-snug text-foreground", task.done && "text-muted-foreground line-through")}>
          <span className="mr-1">{cat.icon}</span>{task.title}
        </span>
        <span className="text-xs text-muted-foreground">Tarea · {cat.label}</span>
      </button>
    </li>
  );
}
