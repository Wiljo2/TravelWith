"use client";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import HourGutter from "./HourGutter";
import DayColumn from "./DayColumn";
import DateStrip from "./DateStrip";
import { GridStartContext, calendarStartHour } from "./gridStart";
import { cn } from "@/lib/utils";
import type { Day, CalendarEvent, DragPreview, TripSpan, Task } from "@/types";
import { cssZoom } from "@/utils/zoom";
import { resolveForDay } from "@/utils/spans";
import { useIsMobile, useIsTouch } from "@/hooks/useMediaQuery";
import { useTouchDrag } from "@/hooks/useTouchDrag";

const GUTTER_W = 56;
const GUTTER_W_MOBILE = 44;
const DAY_MIN  = 165;
const MAX_DAYS = 5;
const SWIPE_MIN_PX = 50;

function calcVisible(containerWidth: number): number {
  const available = containerWidth - GUTTER_W;
  return Math.max(1, Math.min(MAX_DAYS, Math.floor(available / DAY_MIN)));
}

interface CalendarGridProps {
  days: Day[];
  tripSpans: TripSpan[];
  tasks: Task[];
  onDragStart: (e: React.DragEvent, ev: CalendarEvent, dayId: string, grabOffsetHours: number) => void;
  onTouchDragStart: (ev: CalendarEvent, dayId: string, grabOffsetHours: number) => void;
  onTouchDragCancel: () => void;
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
  onSwapDays: (aId: string, bId: string) => void;
  onSetDaySub: (dayId: string, sub: string) => void;
  pendingNew?: { dayId: string; hour: number } | null;
  // Day to open on first render, e.g. today while the trip is underway.
  initialDayIdx?: number;
}

export default function CalendarGrid({
  days, tripSpans, tasks, onDragStart, onTouchDragStart, onTouchDragCancel, onDragEnter, onDragMove, onDrop, onDragEnd,
  onSelect, selectedId, dragTarget, dragPreview, onAddEvent, onToggleTask, onEditTask, onSwapDays, onSetDaySub, pendingNew,
  initialDayIdx,
}: CalendarGridProps) {
  const mobile = useIsMobile();
  const touch = useIsTouch();
  const containerRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [containerW, setContainerW] = useState(900);
  const [startIdx, setStartIdx] = useState(0);
  const [slideDir, setSlideDir] = useState<-1 | 0 | 1>(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => setContainerW(el.getBoundingClientRect().width / cssZoom(el));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const jumpedToInitial = useRef(false);
  useEffect(() => {
    if (jumpedToInitial.current || initialDayIdx == null || initialDayIdx < 0) return;
    jumpedToInitial.current = true;
    setStartIdx(initialDayIdx);
  }, [initialDayIdx]);

  const gridStart = useMemo(() => calendarStartHour(days, tasks), [days, tasks]);
  const gutterW  = mobile ? GUTTER_W_MOBILE : GUTTER_W;
  const visible  = mobile ? 1 : calcVisible(containerW);
  const maxStart = Math.max(0, days.length - visible);
  const idx      = Math.min(startIdx, maxStart);
  const slice    = days.slice(idx, idx + visible);

  const goTo = useCallback((next: number) => {
    const clamped = Math.max(0, Math.min(maxStart, next));
    setSlideDir(clamped > idx ? 1 : clamped < idx ? -1 : 0);
    setStartIdx(clamped);
  }, [idx, maxStart]);
  const goLeft  = useCallback(() => goTo(idx - 1), [goTo, idx]);
  const goRight = useCallback(() => goTo(idx + 1), [goTo, idx]);

  const touchDrag = useTouchDrag({
    onStart: onTouchDragStart,
    onEnter: onDragEnter,
    onMove: onDragMove,
    onDrop,
    onCancel: onTouchDragCancel,
    onEdge: (dir) => (dir < 0 ? goLeft() : goRight()),
    getEdges: () => {
      const el = bodyRef.current;
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      return { left: rect.left + gutterW * cssZoom(el), right: rect.right };
    },
  });

  // Horizontal swipe on the phone layout pages between days.
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  function onSwipeStart(e: React.TouchEvent) {
    swipeStart.current = mobile && e.touches.length === 1
      ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
      : null;
  }
  function onSwipeEnd(e: React.TouchEvent) {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start || touchDrag.draggingId) return;
    const dx = e.changedTouches[0].clientX - start.x;
    const dy = e.changedTouches[0].clientY - start.y;
    if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (dx < 0) goRight(); else goLeft();
  }

  const columns = slice.map((day) => {
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
        onSwapDays={onSwapDays}
        onSetDaySub={onSetDaySub}
        selectedId={selectedId}
        isDragTarget={dragTarget === day.id}
        dragPreview={dragPreview}
        pendingHour={pendingNew?.dayId === day.id ? pendingNew.hour : null}
        onTouchPress={touch ? touchDrag.startPress : undefined}
        touchDraggingId={touchDrag.draggingId}
      />
    );
  });

  return (
    <GridStartContext.Provider value={gridStart}>
    <div
      ref={containerRef}
      className="flex min-w-0 flex-1 flex-col overflow-clip rounded-2xl bg-card shadow-[0_1px_2px_rgba(0,0,0,.04)] ring-1 ring-border/70"
    >
      {/* Navigation: date chips on phones (sticky while scrolling hours), dots on desktop */}
      {mobile ? (
        <div className="sticky top-0 z-20 border-b border-border bg-secondary/95 backdrop-blur-md">
          <DateStrip days={days} activeIdx={idx} onPick={goTo} />
        </div>
      ) : (
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
      )}

      {/* Calendar body */}
      <div ref={bodyRef} className="flex flex-1 overflow-hidden" onTouchStart={onSwipeStart} onTouchEnd={onSwipeEnd}>
        {/* Gutter: header spacer height matches day column header (56px) */}
        <div className="shrink-0" style={{ width: gutterW }}>
          <div className="h-14 border-b border-border" />
          <HourGutter width={gutterW} />
        </div>

        {mobile ? (
          <div
            key={idx}
            className={cn(
              "flex min-w-0 flex-1 duration-200 animate-in fade-in-0",
              slideDir > 0 && "slide-in-from-right-6",
              slideDir < 0 && "slide-in-from-left-6",
            )}
          >
            {columns}
          </div>
        ) : columns}
      </div>
    </div>
    </GridStartContext.Provider>
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
