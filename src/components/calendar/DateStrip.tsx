"use client";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import type { Day } from "@/types";

interface DateStripProps {
  days: Day[];
  activeIdx: number;
  onPick: (idx: number) => void;
}

// Phone day picker: horizontally scrollable chips that keep the active day centered.
export default function DateStrip({ days, activeIdx, onPick }: DateStripProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scroller = scrollerRef.current;
    const chip = scroller?.children[activeIdx] as HTMLElement | undefined;
    if (!scroller || !chip) return;
    scroller.scrollTo({
      left: chip.offsetLeft - scroller.clientWidth / 2 + chip.offsetWidth / 2,
      behavior: "smooth",
    });
  }, [activeIdx]);

  return (
    <div
      ref={scrollerRef}
      className="flex gap-1 overflow-x-auto px-2 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {days.map((d, i) => {
        const [weekday, date] = d.label.split("·").map((s) => s.trim());
        const active = i === activeIdx;
        return (
          <button
            key={d.id}
            onClick={() => onPick(i)}
            className={cn(
              "flex min-w-[54px] shrink-0 cursor-pointer flex-col items-center rounded-xl px-2 py-1 transition-colors",
              active ? "bg-primary text-primary-foreground" : "text-secondary-foreground active:bg-muted",
            )}
          >
            <span className={cn("text-[10px] font-medium uppercase tracking-wide", !active && "text-muted-foreground")}>
              {weekday}
            </span>
            <span className="whitespace-nowrap text-[13px] font-semibold tabular-nums">{date ?? ""}</span>
          </button>
        );
      })}
    </div>
  );
}
