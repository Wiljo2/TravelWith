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

// Day filter of the trip map: compact calendar-style buttons (weekday over the
// date) in each day's color, scrolling sideways; the selected one stays in view.
export default function DayStrip({ days, selected, onSelect }: {
  days: Day[];
  selected: number | null;
  onSelect: (idx: number | null) => void;
}) {
  const row = useRef<HTMLDivElement>(null);
  useEffect(() => {
    row.current?.querySelector<HTMLElement>("[aria-pressed=true]")?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [selected]);

  const base = "flex h-12 shrink-0 cursor-pointer snap-start flex-col items-center justify-center rounded-2xl ring-1 transition-colors";
  return (
    <div
      ref={row}
      role="toolbar"
      aria-label="Filtrar por día"
      className="-mx-4 flex snap-x scroll-px-4 gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden"
    >
      <button
        onClick={() => onSelect(null)}
        aria-pressed={selected == null}
        className={cn(base, "px-3.5 text-[13px] font-semibold",
          selected == null ? "bg-foreground text-background ring-foreground" : "bg-card text-secondary-foreground ring-border")}
      >
        Todo
      </button>
      {days.map((d, i) => {
        const { weekday, num } = parts(d, i);
        const active = selected === i;
        const color = dayColor(i);
        return (
          <button
            key={d.id}
            onClick={() => onSelect(i)}
            aria-pressed={active}
            aria-label={d.label}
            className={cn(base, "w-12", active ? "text-white ring-transparent" : "bg-card text-foreground ring-border")}
            style={active ? { background: color } : undefined}
          >
            <span className={cn("text-[10px] font-semibold leading-none tracking-wide", !active && "text-muted-foreground")}>{weekday}</span>
            <span className="mt-0.5 text-[17px] font-semibold leading-none tabular-nums">{num}</span>
            {!active && <span className="mt-1 h-[3px] w-4 rounded-full" style={{ background: color }} />}
          </button>
        );
      })}
    </div>
  );
}
