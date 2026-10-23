"use client";
import { useState } from "react";
import type { Ref } from "react";
import { Plus } from "lucide-react";
import { CATEGORIES } from "@/constants/categories";
import { TASK_CATEGORIES, DEFAULT_TASK_CAT } from "@/constants/taskCategories";
import { fmtHour } from "@/utils/time";
import { eventIcon, taskIcon } from "@/utils/itemIcon";
import { nextFreeHour } from "@/utils/tripDays";
import { agendaRows } from "@/utils/agendaRows";
import { PANEL } from "@/components/home/shared";
import { Button } from "@/components/ui/button";
import DaySubtitle from "@/components/itinerary/DaySubtitle";
import { DaySpanChips, TaskCheck } from "@/components/itinerary/agendaParts";
import { cn } from "@/lib/utils";
import type { CalendarEvent, Day, Task } from "@/types";

const VISIBLE_ROWS = 5;

interface AgendaCardProps {
  ref?: Ref<HTMLElement>;
  day: Day;
  tasks: Task[];
  chips: { label: string; color: string }[];
  isToday: boolean;
  selectedId: string | null;
  tipsByEvent?: Record<string, number>;
  onSelect: (id: string) => void;
  onAdd: (dayId: string, hour: number, x: number, y: number) => void;
  onEditTask: (task: Task, x: number, y: number) => void;
  onToggleTask: (id: string) => void;
  onSetDaySub: (dayId: string, sub: string) => void;
}

// A day as a compact desktop card: one line per activity or scheduled task, the
// first few and "+N más" to expand the card in place.
export default function AgendaCard({
  ref, day, tasks, chips, isToday, selectedId, tipsByEvent, onSelect, onAdd, onEditTask, onToggleTask, onSetDaySub,
}: AgendaCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [weekday, date] = day.label.split("·").map((s) => s.trim());
  const rows = agendaRows(day, tasks);
  const hidden = rows.length - VISIBLE_ROWS;
  const shown = expanded ? rows : rows.slice(0, VISIBLE_ROWS);

  return (
    <section ref={ref} className={cn(PANEL, "flex min-w-0 scroll-mt-4 flex-col md:p-4", isToday && "ring-2 ring-primary")}>
      <h3 className="flex items-center gap-2 text-[15px] font-semibold">
        {weekday} {date}
        {isToday && <span className="rounded-full bg-primary px-2 py-px text-[11px] font-semibold text-primary-foreground">Hoy</span>}
      </h3>
      <DaySubtitle value={day.sub ?? ""} onCommit={(sub) => onSetDaySub(day.id, sub)} className="text-[13px] text-muted-foreground" />
      <DaySpanChips chips={chips} />

      <div className="mt-2 flex-1">
        {rows.length === 0 ? (
          <p className="py-1 text-[13px] text-muted-foreground">Día libre, sin actividades aún.</p>
        ) : (
          <ul className="-mx-2 flex flex-col">
            {shown.map((r) =>
              r.kind === "event"
                ? <EventLine key={r.ev.id} ev={r.ev} selected={r.ev.id === selectedId} tips={tipsByEvent?.[r.ev.id]} onClick={() => onSelect(r.ev.id)} />
                : <TaskLine key={r.task.id} task={r.task} onEdit={onEditTask} onToggle={() => onToggleTask(r.task.id)} />,
            )}
          </ul>
        )}
        {hidden > 0 && (
          <Button
            variant="link"
            size="xs"
            aria-expanded={expanded}
            onClick={() => setExpanded(!expanded)}
            className="mt-0.5 -ml-2 text-[13px] text-muted-foreground hover:text-foreground"
          >
            {expanded ? "Ver menos" : `+${hidden} más`}
          </Button>
        )}
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={(e) => onAdd(day.id, nextFreeHour(day), e.clientX, e.clientY)}
        className="mt-2 -ml-2 self-start rounded-full text-[13px] text-emerald-700 hover:bg-accent hover:text-emerald-700"
      >
        <Plus />
        Actividad
      </Button>
    </section>
  );
}

const TIME = "w-16 shrink-0 whitespace-nowrap text-[12px] tabular-nums text-muted-foreground";

function EventLine({ ev, selected, tips, onClick }: { ev: CalendarEvent; selected: boolean; tips?: number; onClick: () => void }) {
  const cat = CATEGORIES[ev.cat] ?? CATEGORIES.logist;
  return (
    <li>
      <button
        onClick={onClick}
        title={ev.title}
        className={cn(
          "flex w-full cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-left text-[13px] transition-colors",
          selected ? "bg-accent" : "hover:bg-secondary",
        )}
      >
        <span className={TIME}>{fmtHour(ev.start)}</span>
        <span className="flex w-4 shrink-0 justify-center">
          <span className="h-2 w-2 rounded-full" style={{ background: cat.dot }} />
        </span>
        <span className="min-w-0 flex-1 truncate text-foreground">
          <span aria-hidden className="mr-1">{eventIcon(ev)}</span>{ev.title}
        </span>
        {!!tips && <span className="shrink-0 text-xs font-semibold text-muted-foreground">💡{tips}</span>}
      </button>
    </li>
  );
}

function TaskLine({ task, onEdit, onToggle }: { task: Task; onEdit: (t: Task, x: number, y: number) => void; onToggle: () => void }) {
  const cat = TASK_CATEGORIES[task.cat ?? DEFAULT_TASK_CAT] ?? TASK_CATEGORIES[DEFAULT_TASK_CAT];
  return (
    <li className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[13px] hover:bg-secondary">
      <span className={TIME}>{fmtHour(task.start ?? 0)}</span>
      <TaskCheck task={task} color={cat.border} onToggle={onToggle} />
      <button
        onClick={(e) => onEdit(task, e.clientX, e.clientY)}
        title={`Tarea · ${cat.label}`}
        className={cn("min-w-0 flex-1 cursor-pointer truncate text-left text-foreground", task.done && "text-muted-foreground line-through")}
      >
        <span aria-hidden className="mr-1">{taskIcon(task)}</span>{task.title}
      </button>
    </li>
  );
}
