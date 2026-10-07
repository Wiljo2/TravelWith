"use client";
import { CalendarDays } from "lucide-react";
import { fmtHour } from "@/utils/time";
import { cn } from "@/lib/utils";
import type { Day, IdeaMoment } from "@/types";

const AUTO = "auto";

// <select> value of a moment: "auto" (unset), "before", "none", "d:<day>" or
// "e:<day>:<event>". An activity no longer in the plan reads as its day.
function encode(m: IdeaMoment | undefined, days: Day[]): string {
  if (!m) return AUTO;
  if (m.before) return "before";
  const day = m.dayId ? days.find((d) => d.id === m.dayId) : undefined;
  if (!day) return m.dayId ? AUTO : "none";
  return m.eventId && day.events.some((e) => e.id === m.eventId) ? `e:${day.id}:${m.eventId}` : `d:${day.id}`;
}

function decode(value: string): IdeaMoment | undefined {
  if (value === AUTO) return undefined;
  if (value === "before") return { before: true };
  if (value === "none") return {};
  const [kind, dayId, eventId] = value.split(":");
  return kind === "e" ? { dayId, eventId } : { dayId };
}

// Where an idea goes in the plan, picked by hand: a day, one of its
// activities, before the trip or nowhere. "Automático" goes back to the analysis.
export default function IdeaMomentSelect({ days, moment, when, onChange, className }: {
  days: Day[];
  moment: IdeaMoment | undefined;
  when?: string;      // where it shows now, when automatic
  onChange: (moment: IdeaMoment | undefined) => void;
  className?: string;
}) {
  return (
    <label className={cn("relative block", className)}>
      <CalendarDays className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-emerald-700" />
      <select
        value={encode(moment, days)}
        onChange={(e) => onChange(decode(e.target.value))}
        aria-label="Momento en el plan"
        className="h-10 w-full min-w-0 cursor-pointer truncate rounded-xl border border-border bg-card pl-8 pr-2.5 text-[13px] text-foreground outline-none"
      >
        <option value={AUTO}>{moment ? "↺ Automático (según el análisis)" : `✨ ${when ?? "Sin momento en el plan"}`}</option>
        <option value="before">📋 Antes del viaje</option>
        <option value="none">Sin momento en el plan</option>
        {days.map((d) => (
          <optgroup key={d.id} label={[d.label, d.sub].filter(Boolean).join(" — ")}>
            <option value={`d:${d.id}`}>{d.label} · todo el día</option>
            {[...d.events].sort((a, b) => a.start - b.start).map((e) => (
              <option key={e.id} value={`e:${d.id}:${e.id}`}>{fmtHour(e.start)} · {e.title}</option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}
