"use client";
import { CATEGORIES } from "@/constants/categories";
import { eventIcon } from "@/utils/itemIcon";
import { MONTHS } from "@/utils/tripDays";
import { spanRanges } from "@/utils/spans";
import { tripWeeks, weekBars, WEEK_HEADERS } from "@/utils/tripWeeks";
import type { WeekBar, WeekDay } from "@/utils/tripWeeks";
import { cn } from "@/lib/utils";
import type { CalendarEvent, Day, TripSpan } from "@/types";

const TITLES = 3;     // activity titles per day, when the month is wide enough
const DOTS = 4;       // category dots per day, when it isn't
const HEAD_PX = 24;   // a day's number row (pt-1 + h-5): span lanes start below it
const LANE_PX = 16;

interface MonthViewProps {
  startDate: string;
  endDate: string;
  days: Day[];
  tripSpans: TripSpan[];
  todayIdx?: number;
  onOpenDay: (dayId: string) => void;
}

// The trip on Mon–Sun rows, only the weeks it touches: each day's first activities
// (category dots when narrow) under the spans drawn as bars. View only.
export default function MonthView({ startDate, endDate, days, tripSpans, todayIdx, onOpenDay }: MonthViewProps) {
  const weeks = tripWeeks(startDate, endDate);
  const bars = weekBars(weeks, spanRanges(days, tripSpans));

  return (
    <div className="@container">
      <div className="flex flex-col gap-px overflow-hidden rounded-2xl bg-border shadow-[0_1px_2px_rgba(0,0,0,.04)] ring-1 ring-border/70">
        <div className="grid grid-cols-7 gap-px">
          {WEEK_HEADERS.map((h) => (
            <div key={h} className="bg-card py-1.5 text-center text-[11px] font-semibold text-muted-foreground">{h}</div>
          ))}
        </div>
        {weeks.map((week, w) => (
          <div key={week[0].iso} className="relative grid grid-cols-7 gap-px">
            {week.map((cell, i) => (
              <MonthDay
                key={cell.iso}
                cell={cell}
                day={cell.inTrip ? days[cell.dayIdx] : undefined}
                isToday={cell.inTrip && cell.dayIdx === todayIdx}
                withMonth={(w === 0 && i === 0) || cell.day === 1}
                laneSpace={bars[w].reduce((n, b) => Math.max(n, b.lane + 1), 0) * LANE_PX}
                onOpen={onOpenDay}
              />
            ))}
            {bars[w].map((b) => <SpanBar key={b.id} bar={b} />)}
          </div>
        ))}
      </div>
    </div>
  );
}

function MonthDay({ cell, day, isToday, withMonth, laneSpace, onOpen }: {
  cell: WeekDay; day?: Day; isToday: boolean; withMonth: boolean; laneSpace: number; onOpen: (dayId: string) => void;
}) {
  const base = "flex min-h-14 min-w-0 flex-col bg-card px-0.5 pt-1 pb-1.5 text-left @xl:min-h-24";
  const head = (
    <>
      <span className="flex h-5 min-w-0 items-center">
        <span className={cn("truncate rounded-full px-1 text-[11px] font-semibold tabular-nums @xl:text-xs", isToday && "bg-primary text-primary-foreground")}>
          {withMonth ? `${MONTHS[cell.month]} ${cell.day}` : cell.day}
        </span>
      </span>
      <span aria-hidden className="block shrink-0" style={{ height: laneSpace }} />
    </>
  );

  if (!day) {
    return <div className={cn(base, !cell.inTrip && "bg-muted text-muted-foreground/60")}>{head}</div>;
  }

  const events = [...day.events].sort((a, b) => a.start - b.start);
  const count = events.length === 0 ? "sin actividades" : events.length === 1 ? "1 actividad" : `${events.length} actividades`;
  return (
    <button
      onClick={() => onOpen(day.id)}
      aria-label={`${day.label}: ${count}`}
      className={cn(base, "cursor-pointer text-foreground transition-colors hover:bg-secondary")}
    >
      {head}
      <DayActivities events={events} />
    </button>
  );
}

function DayActivities({ events }: { events: CalendarEvent[] }) {
  if (events.length === 0) return null;
  const moreTitles = events.length - TITLES;
  const moreDots = events.length - DOTS;
  return (
    <>
      <span className="hidden min-w-0 flex-col @xl:flex">
        {events.slice(0, TITLES).map((ev) => (
          <span key={ev.id} className="truncate px-1 text-[11px] leading-4">
            <span aria-hidden className="mr-0.5">{eventIcon(ev)}</span>{ev.title}
          </span>
        ))}
        {moreTitles > 0 && <span className="px-1 text-[11px] font-medium leading-4 text-muted-foreground">+{moreTitles}</span>}
      </span>
      <span className="flex flex-wrap items-center gap-0.5 px-1 @xl:hidden">
        {events.slice(0, DOTS).map((ev) => (
          <span key={ev.id} className="h-1.5 w-1.5 rounded-full" style={{ background: (CATEGORIES[ev.cat] ?? CATEGORIES.logist).dot }} />
        ))}
        {moreDots > 0 && <span className="text-[10px] font-medium leading-none text-muted-foreground">+{moreDots}</span>}
      </span>
    </>
  );
}

// Columns are (100% - 6 gaps) / 7 wide, so column k starts at k * (100% + 1px) / 7.
function SpanBar({ bar }: { bar: WeekBar }) {
  const cols = bar.endCol - bar.startCol + 1;
  const startInset = bar.continuesBefore ? 0 : 3;
  const endInset = bar.continuesAfter ? 0 : 3;
  return (
    <div
      className={cn(
        "pointer-events-none absolute flex h-3.5 items-center overflow-hidden border px-1 text-[10px] font-medium leading-none text-foreground",
        bar.continuesBefore ? "border-l-0" : "rounded-l",
        bar.continuesAfter ? "border-r-0" : "rounded-r",
      )}
      style={{
        top: HEAD_PX + bar.lane * LANE_PX,
        left: `calc(${bar.startCol} * (100% + 1px) / 7 + ${startInset}px)`,
        width: `calc(${cols} * (100% + 1px) / 7 - ${1 + startInset + endInset}px)`,
        background: bar.bg,
        borderColor: bar.color,
      }}
    >
      <span className="truncate">{bar.label}</span>
    </div>
  );
}
