"use client";
import { useEffect, useRef } from "react";
import { dayColor } from "@/constants/mapColors";
import { cn } from "@/lib/utils";
import type { Day } from "@/types";

// "Jue · Nov 26" → { weekday: "JUE", num: "26" }.
function parts(day: Day, idx: number) {
  const [weekday, date] = day.label.split("·").map((s) => s.trim());
  return { weekday: (weekday ?? "").slice(0, 3).toUpperCase(), num: date?.match(/\d+/)?.[0] ?? String(idx + 1) };
}

// Day filter of the trip map (and the ideas by day): compact calendar-style
// buttons (weekday over the date) in each day's color, scrolling sideways; the
// selected one stays in view. With `counts`, days with nothing are disabled.
export default function DayStrip({ days, selected, onSelect, counts, before }: {
  days: Day[];
  selected: number | null;
  onSelect: (idx: number | null) => void;
  counts?: number[];
  // An extra "Antes" button for what happens before the trip.
  before?: { count: number; active: boolean; onSelect: () => void };
}) {
  const row = useRef<HTMLDivElement>(null);
  useEffect(() => {
    row.current?.querySelector<HTMLElement>("[aria-pressed=true]")?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [selected, before?.active]);
  const all = selected == null && !before?.active;

  const base = "flex h-12 shrink-0 cursor-pointer snap-start flex-col items-center justify-center rounded-2xl ring-1 transition-colors";
  return (
    <div
      ref={row}
      role="toolbar"
      aria-label="Filtrar por día"
      className={cn(
        "-mx-4 flex snap-x scroll-px-4 gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden",
        (counts || before) && "pt-1.5 md:pr-1",
      )}
    >
      <button
        onClick={() => onSelect(null)}
        aria-pressed={all}
        className={cn(base, "px-3.5 text-[13px] font-semibold",
          all ? "bg-foreground text-background ring-foreground" : "bg-card text-secondary-foreground ring-border")}
      >
        Todo
      </button>
      {before && before.count > 0 && (
        <button
          onClick={before.onSelect}
          aria-pressed={before.active}
          className={cn(base, "relative px-3.5 text-[13px] font-semibold",
            before.active ? "bg-foreground text-background ring-foreground" : "bg-card text-secondary-foreground ring-border")}
        >
          Antes
          <Count n={before.count} />
        </button>
      )}
      {days.map((d, i) => {
        const { weekday, num } = parts(d, i);
        const active = selected === i;
        const color = dayColor(i);
        const n = counts?.[i];
        return (
          <button
            key={d.id}
            onClick={() => onSelect(i)}
            disabled={n === 0}
            aria-pressed={active}
            aria-label={d.label}
            className={cn(base, "relative w-12 disabled:cursor-default disabled:opacity-35", active ? "text-white ring-transparent" : "bg-card text-foreground ring-border")}
            style={active ? { background: color } : undefined}
          >
            {!!n && <Count n={n} />}
            <span className={cn("text-[10px] font-semibold leading-none tracking-wide", !active && "text-muted-foreground")}>{weekday}</span>
            <span className="mt-0.5 text-[17px] font-semibold leading-none tabular-nums">{num}</span>
            {!active && <span className="mt-1 h-[3px] w-4 rounded-full" style={{ background: color }} />}
          </button>
        );
      })}
    </div>
  );
}

function Count({ n }: { n: number }) {
  return (
    <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground">
      {n}
    </span>
  );
}
