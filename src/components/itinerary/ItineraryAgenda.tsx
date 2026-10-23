"use client";
import { useEffect, useRef } from "react";
import { Plus } from "lucide-react";
import { CATEGORIES } from "@/constants/categories";
import { TASK_CATEGORIES, DEFAULT_TASK_CAT } from "@/constants/taskCategories";
import { fmtHour } from "@/utils/time";
import { eventIcon, taskIcon } from "@/utils/itemIcon";
import { hasActivities, nextFreeHour } from "@/utils/tripDays";
import { daySpanLabels } from "@/utils/spans";
import { agendaRows } from "@/utils/agendaRows";
import { PANEL } from "@/components/home/shared";
import DaySubtitle from "@/components/itinerary/DaySubtitle";
import ItineraryIntro from "@/components/itinerary/ItineraryIntro";
import AgendaCard from "@/components/itinerary/AgendaCard";
import { DaySpanChips, TaskCheck } from "@/components/itinerary/agendaParts";
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
  onSetDaySub: (dayId: string, sub: string) => void;
  tipsByEvent?: Record<string, number>;   // video advice placed on each activity
  // Desktop: compact cards in columns instead of the phone's full-width cards.
  compact?: boolean;
  // Scrolled into view on mount instead of today (a day opened from the month view).
  focusDayId?: string | null;
}

// The whole trip as a list of day cards — the default, low-noise itinerary view.
export default function ItineraryAgenda({
  days, tripSpans, tasks, selectedId, todayIdx, onSelect, onAdd, onEditTask, onToggleTask, onSetDaySub, tipsByEvent, compact, focusDayId,
}: ItineraryAgendaProps) {
  const scrollRef = useRef<HTMLElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [focusDayId]);
  const scrollDayId = focusDayId ?? (todayIdx !== undefined ? days[todayIdx]?.id : undefined);
  const firstDay = days[todayIdx ?? 0] ?? days[0];
  const intro = firstDay && !hasActivities(days) && (
    <ItineraryIntro view="agenda" onAdd={(x, y) => onAdd(firstDay.id, nextFreeHour(firstDay), x, y)} />
  );

  if (compact) {
    return (
      <div className="@container flex flex-col gap-4">
        {intro}
        <div className="grid gap-4 @xl:grid-cols-2 @3xl:grid-cols-3">
          {days.map((day, i) => (
            <AgendaCard
              key={day.id}
              ref={day.id === scrollDayId ? scrollRef : undefined}
              day={day}
              tasks={tasks}
              chips={daySpanLabels(day, days, tripSpans)}
              isToday={i === todayIdx}
              selectedId={selectedId}
              tipsByEvent={tipsByEvent}
              onSelect={onSelect}
              onAdd={onAdd}
              onEditTask={onEditTask}
              onToggleTask={onToggleTask}
              onSetDaySub={onSetDaySub}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {intro}
      {days.map((day, i) => {
        const [weekday, date] = day.label.split("·").map((s) => s.trim());
        const isToday = i === todayIdx;
        const chips = daySpanLabels(day, days, tripSpans);
        const rows = agendaRows(day, tasks);

        return (
          <section
            key={day.id}
            ref={day.id === scrollDayId ? scrollRef : undefined}
            className={cn(PANEL, "scroll-mt-4", isToday && "ring-2 ring-primary")}
          >
            <div className="mb-2 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="flex items-center gap-2 text-[15px] font-semibold">
                  {weekday} {date}
                  {isToday && <span className="rounded-full bg-primary px-2 py-px text-[11px] font-semibold text-primary-foreground">Hoy</span>}
                </h3>
                <DaySubtitle value={day.sub ?? ""} onCommit={(sub) => onSetDaySub(day.id, sub)} className="text-[13px] text-muted-foreground" />
                <DaySpanChips chips={chips} />
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
                    ? <EventRow key={r.ev.id} ev={r.ev} selected={r.ev.id === selectedId} tips={tipsByEvent?.[r.ev.id]} onClick={() => onSelect(r.ev.id)} />
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

function EventRow({ ev, selected, tips, onClick }: { ev: CalendarEvent; selected: boolean; tips?: number; onClick: () => void }) {
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
          <span className="block text-sm font-medium leading-snug text-foreground"><span aria-hidden className="mr-1">{eventIcon(ev)}</span>{ev.title}{!!tips && <span className="ml-1.5 text-xs font-semibold text-muted-foreground">💡{tips}</span>}</span>
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
      <TaskCheck task={task} color={cat.border} onToggle={onToggle} className="mt-0.5" />
      <button onClick={(e) => onEdit(task, e.clientX, e.clientY)} className="min-w-0 flex-1 cursor-pointer text-left">
        <span className={cn("block text-sm leading-snug text-foreground", task.done && "text-muted-foreground line-through")}>
          <span aria-hidden className="mr-1">{taskIcon(task)}</span>{task.title}
        </span>
        <span className="text-xs text-muted-foreground">Tarea · {cat.label}</span>
      </button>
    </li>
  );
}
