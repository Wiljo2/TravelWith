"use client";
import { CATEGORIES } from "@/constants/categories";
import { fmtHour } from "@/utils/time";
import { eventIcon } from "@/utils/itemIcon";
import { cn } from "@/lib/utils";
import type { CalendarEvent, Day } from "@/types";

interface DayAgendaProps {
  day: Day;
  highlight?: boolean;
  // Show at most this many activities, then a "+N más" link.
  limit?: number;
  onOpen?: () => void;
}

// A day as a plain chronological list: time · category dot · title. No empty hours.
export default function DayAgenda({ day, highlight, limit, onOpen }: DayAgendaProps) {
  const [weekday, date] = day.label.split("·").map((s) => s.trim());
  const sorted = [...day.events].sort((a, b) => a.start - b.start);
  const events = limit ? sorted.slice(0, limit) : sorted;
  const hidden = sorted.length - events.length;

  return (
    <div>
      <button
        onClick={onOpen}
        disabled={!onOpen}
        className="mb-2 flex w-full items-baseline gap-2 text-left enabled:cursor-pointer"
      >
        <span className={cn("text-sm font-semibold", highlight ? "text-emerald-700" : "text-foreground")}>
          {weekday} {date}
        </span>
        {day.sub && <span className="truncate text-[13px] text-muted-foreground">{day.sub}</span>}
      </button>

      {events.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">Día libre, sin actividades aún.</p>
      ) : (
        <ul className="flex flex-col">
          {events.map((ev) => <AgendaRow key={ev.id} ev={ev} />)}
          {hidden > 0 && (
            <li>
              <button
                onClick={onOpen}
                disabled={!onOpen}
                className="ml-[80px] py-1 text-[13px] font-medium text-muted-foreground enabled:cursor-pointer enabled:hover:text-foreground"
              >
                + {hidden} más
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

export function AgendaRow({ ev }: { ev: CalendarEvent }) {
  const cat = CATEGORIES[ev.cat] ?? CATEGORIES.logist;
  return (
    <li className="flex items-start gap-3 py-1.5">
      <span className="w-[68px] shrink-0 pt-px text-[13px] tabular-nums text-muted-foreground">
        {fmtHour(ev.start)}
      </span>
      <span className="mt-[7px] h-2 w-2 shrink-0 rounded-full" style={{ background: cat.dot }} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-foreground"><span aria-hidden className="mr-1">{eventIcon(ev)}</span>{ev.title}</span>
        {ev.note && <span className="block truncate text-xs text-muted-foreground">{ev.note}</span>}
      </span>
    </li>
  );
}
