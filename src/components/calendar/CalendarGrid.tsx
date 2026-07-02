"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import HourGutter from "./HourGutter";
import DayColumn from "./DayColumn";
import { cn } from "@/lib/utils";
import type { Day, CalendarEvent, DragPreview, TripSpan, DaySpan, Task } from "@/types";
import { CATEGORIES } from "@/constants/categories";
import { HOUR_START, HOUR_END } from "@/constants/time";

// Given all days and all trip-level spans, compute the DaySpan slices visible
// in a specific day. A span crossing N days produces a slice in each of those days.
function resolveForDay(day: Day, allDays: Day[], tripSpans: TripSpan[]): DaySpan[] {
  const dayIdx = allDays.findIndex((d) => d.id === day.id);
  const result: DaySpan[] = [];

  for (const span of tripSpans) {
    let startDayIdx = -1, endDayIdx = -1;
    let startHour = HOUR_START, endHour = HOUR_END + 1;

    for (let i = 0; i < allDays.length; i++) {
      const s = allDays[i].events.find((e) => e.id === span.startEventId);
      if (s) { startDayIdx = i; startHour = s.start; }
      const e = allDays[i].events.find((e) => e.id === span.endEventId);
      if (e) { endDayIdx = i; endHour = e.end; }
    }

    if (startDayIdx < 0 || endDayIdx < 0) continue;         // events not found
    if (dayIdx < startDayIdx || dayIdx > endDayIdx) continue; // day outside range

    result.push({
      id: `trip-${span.id}-d${dayIdx}`,
      label: span.label,
      // First day: start at event time. Middle/last days: start at top of grid.
      startHour: dayIdx === startDayIdx ? startHour : HOUR_START,
      // Last day: end at event time. First/middle days: go to bottom of grid.
      endHour:   dayIdx === endDayIdx   ? endHour   : HOUR_END + 1,
      bg:     span.bg,
      border: span.border,
      zIndex: span.zIndex ?? 1,
    });
  }

  return result;
}

const GUTTER_W = 56;
const DAY_MIN  = 165;
const MAX_DAYS = 5;

function calcVisible(containerWidth: number): number {
  const available = containerWidth - GUTTER_W;
  return Math.max(1, Math.min(MAX_DAYS, Math.floor(available / DAY_MIN)));
}

interface CalendarGridProps {
  days: Day[];
  tripSpans: TripSpan[];
  tasks: Task[];
  onDragStart: (e: React.DragEvent, ev: CalendarEvent, dayId: string, grabOffsetHours: number) => void;
  onDragEnter: (dayId: string) => void;
  onDragMove: (dayId: string, cursorHour: number) => void;
  onDrop: (dayId: string, droppedHour: number) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onSelect: (id: string | null) => void;
  selectedId: string | null;
  dragTarget: string | null;
  dragPreview: DragPreview | null;
  onAddEvent: (dayId: string, atHour: number, x: number, y: number) => void;
  onToggleTask: (id: string) => void;
  onEditTask: (task: Task, x: number, y: number) => void;
  pendingNew?: { dayId: string; hour: number } | null;
}

export default function CalendarGrid({
  days, tripSpans, tasks, onDragStart, onDragEnter, onDragMove, onDrop, onDragEnd,
  onSelect, selectedId, dragTarget, dragPreview, onAddEvent, onToggleTask, onEditTask, pendingNew,
}: CalendarGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerW, setContainerW] = useState(900);
  const [startIdx, setStartIdx] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => setContainerW(el.getBoundingClientRect().width);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const visible  = calcVisible(containerW);
  const maxStart = Math.max(0, days.length - visible);
  const idx      = Math.min(startIdx, maxStart);
  const slice    = days.slice(idx, idx + visible);

  const goLeft  = useCallback(() => setStartIdx((s) => Math.max(0, s - 1)), []);
  const goRight = useCallback(() => setStartIdx((s) => Math.min(maxStart, s + 1)), [maxStart]);

  return (
    <div
      ref={containerRef}
      className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-[10px] border border-border bg-card"
    >
      {/* Category legend */}
      <div className="flex h-[34px] shrink-0 items-center gap-2 overflow-x-auto border-b border-border bg-background px-3">
        {Object.entries(CATEGORIES).map(([, c]) => (
          <div key={c.label} className="flex shrink-0 items-center gap-1 whitespace-nowrap">
            <span className="h-2 w-2 shrink-0 rounded-[2px]" style={{ background: c.dot }} />
            <span className="text-[11px] text-muted-foreground">{c.label}</span>
          </div>
        ))}
      </div>

      {/* Navigation bar */}
      <div className="flex min-h-[38px] items-center justify-between gap-2 border-b border-border bg-secondary py-1.5 pl-1.5 pr-2.5">
        <NavArrow dir="left" enabled={idx > 0} onClick={goLeft} />

        <div className="flex flex-1 items-center justify-center gap-1.5">
          {days.map((d, i) => {
            const isVisible = i >= idx && i < idx + visible;
            return (
              <button
                key={d.id}
                onClick={() => setStartIdx(Math.min(i, maxStart))}
                title={d.label}
                className={cn(
                  "h-2 shrink-0 cursor-pointer rounded border-none p-0 transition-all duration-200",
                  isVisible ? "w-5 bg-primary" : "w-2 bg-border",
                )}
              />
            );
          })}
        </div>

        <NavArrow dir="right" enabled={idx < maxStart} onClick={goRight} />
      </div>

      {/* Calendar body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Gutter: header spacer height matches day column header (56px) */}
        <div className="shrink-0" style={{ width: GUTTER_W }}>
          <div className="h-14 border-b border-border" />
          <HourGutter />
        </div>

        {slice.map((day) => {
          // Merge static day.spans with trip-level spans resolved for this day
          const enriched: Day = {
            ...day,
            spans: [
              ...(day.spans ?? []),
              ...resolveForDay(day, days, tripSpans),
            ],
          };
          return (
          <DayColumn
            key={day.id}
            day={enriched}
            tasks={tasks.filter((t) => t.dayId === day.id && t.start != null)}
            onDragStart={onDragStart}
            onDragEnter={onDragEnter}
            onDragMove={onDragMove}
            onDrop={onDrop}
            onDragEnd={onDragEnd}
            onSelect={onSelect}
            onAddEvent={onAddEvent}
            onToggleTask={onToggleTask}
            onEditTask={onEditTask}
            selectedId={selectedId}
            isDragTarget={dragTarget === day.id}
            dragPreview={dragPreview}
            pendingHour={pendingNew?.dayId === day.id ? pendingNew.hour : null}
          />
          );
        })}
      </div>
    </div>
  );
}

function NavArrow({ dir, enabled, onClick }: { dir: "left" | "right"; enabled: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick} disabled={!enabled}
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border text-lg font-light transition-colors",
        enabled ? "cursor-pointer bg-card text-foreground hover:bg-secondary" : "bg-transparent text-border",
      )}
    >
      {dir === "left" ? "‹" : "›"}
    </button>
  );
}
