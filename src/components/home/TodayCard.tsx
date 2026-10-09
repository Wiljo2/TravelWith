"use client";
import { AgendaRow } from "@/components/itinerary/DayAgenda";
import { PANEL, SectionTitle } from "@/components/home/shared";
import { CATEGORIES } from "@/constants/categories";
import { fmtHour, untilLabel } from "@/utils/time";
import { eventIcon } from "@/utils/itemIcon";
import { cn } from "@/lib/utils";
import type { CalendarEvent, Day } from "@/types";

interface TodayCardProps {
  day: Day;
  dayIdx: number;
  dayCount: number;
  hour: number;
  tomorrow?: Day;
  onOpenItinerary: () => void;
}

// Punctual events (end <= start) count as "now" for 15 minutes.
const endOf = (ev: CalendarEvent) => Math.max(ev.end, ev.start + 0.25);

// During the trip: what's happening now, what's next, and the rest of today.
export default function TodayCard({ day, dayIdx, dayCount, hour, tomorrow, onOpenItinerary }: TodayCardProps) {
  const events = [...day.events].sort((a, b) => a.start - b.start);
  const ongoing = events.filter((e) => e.start <= hour && hour < endOf(e));
  const current = ongoing[ongoing.length - 1];
  const next = events.find((e) => e.start > hour);
  const rest = events.filter((e) => e.start > hour && e !== next);
  const firstTomorrow = tomorrow ? [...tomorrow.events].sort((a, b) => a.start - b.start)[0] : undefined;
  const [weekday, date] = day.label.split("·").map((s) => s.trim());

  return (
    <>
      <section className={cn(PANEL, "bg-linear-to-br from-accent to-card")}>
        <div className="mb-3 flex items-baseline justify-between gap-3 text-[13px] text-secondary-foreground">
          <span className="truncate">
            <strong className="font-semibold text-foreground">Día {dayIdx + 1}</strong> de {dayCount}
            {day.sub && <> · {day.sub}</>}
          </span>
          <span className="shrink-0 text-muted-foreground">{weekday} {date}</span>
        </div>

        {current ? (
          <Spotlight ev={current} badge="Ahora" live detail={current.end > current.start ? `Hasta ${fmtHour(current.end)}` : fmtHour(current.start)} />
        ) : next ? (
          <Spotlight ev={next} badge={`Próximo · ${untilLabel(hour, next.start)}`} detail={timeRange(next)} />
        ) : (
          <div>
            <div className="text-xl font-semibold tracking-tight">Nada más por hoy</div>
            <p className="mt-1 text-sm text-secondary-foreground">
              {firstTomorrow
                ? <>Mañana empieza con <strong className="font-medium text-foreground">{firstTomorrow.title}</strong> a las {fmtHour(firstTomorrow.start)}.</>
                : "Descansen, mañana no hay nada planeado."}
            </p>
          </div>
        )}

        {current && next && (
          <div className="mt-4 flex items-center gap-2 border-t border-foreground/10 pt-3 text-[13px] text-secondary-foreground">
            <span className="shrink-0 text-muted-foreground">Luego</span>
            <span className="shrink-0 tabular-nums">{fmtHour(next.start)}</span>
            <span className="truncate font-medium text-foreground"><span aria-hidden className="mr-1">{eventIcon(next)}</span>{next.title}</span>
          </div>
        )}
      </section>

      {rest.length > 0 && (
        <section className={PANEL}>
          <SectionTitle title="Más tarde hoy" action="Itinerario" onAction={onOpenItinerary} />
          <ul className="flex flex-col">
            {rest.map((ev) => <AgendaRow key={ev.id} ev={ev} />)}
          </ul>
        </section>
      )}
    </>
  );
}

function timeRange(ev: CalendarEvent) {
  return ev.end > ev.start ? `${fmtHour(ev.start)} – ${fmtHour(ev.end)}` : fmtHour(ev.start);
}

function Spotlight({ ev, badge, detail, live }: { ev: CalendarEvent; badge: string; detail: string; live?: boolean }) {
  const cat = CATEGORIES[ev.cat] ?? CATEGORIES.logist;
  return (
    <div>
      <span className="inline-flex items-center gap-1.5 rounded-full bg-card px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-primary/40">
        {live && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />}
        {badge}
      </span>
      <div className="mt-2.5 flex items-start gap-2.5">
        <span className="mt-2.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: cat.dot }} />
        <div className="min-w-0">
          <div className="text-xl font-semibold leading-snug tracking-tight md:text-2xl"><span aria-hidden className="mr-1.5">{eventIcon(ev)}</span>{ev.title}</div>
          <div className="mt-0.5 text-sm tabular-nums text-secondary-foreground">{detail}</div>
          {ev.note && <p className="mt-2 text-sm leading-snug text-secondary-foreground">{ev.note}</p>}
        </div>
      </div>
    </div>
  );
}
