"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import HourGutter from "./HourGutter";
import DayColumn from "./DayColumn";
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
      style={{
        flex: "1 1 0", minWidth: 0,
        display: "flex", flexDirection: "column",
        background: "var(--surface-2)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        overflow: "hidden",
      }}
    >
      {/* Category legend */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8, padding: "0 12px",
        height: 34, flexShrink: 0, overflowX: "auto",
        borderBottom: "1px solid var(--border)",
        background: "var(--surface-0)",
      }}>
        {Object.entries(CATEGORIES).map(([, c]) => (
          <div key={c.label} style={{ display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap", flexShrink: 0 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: c.dot, flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{c.label}</span>
          </div>
        ))}
      </div>

      {/* Navigation bar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "6px 10px 6px 6px",
        borderBottom: "1px solid var(--border)",
        background: "var(--surface-1)",
        gap: 8, minHeight: 38,
      }}>
        <NavArrow dir="left" enabled={idx > 0} onClick={goLeft} />

        <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, justifyContent: "center" }}>
          {days.map((d, i) => {
            const isVisible = i >= idx && i < idx + visible;
            return (
              <button
                key={d.id}
                onClick={() => setStartIdx(Math.min(i, maxStart))}
                title={d.label}
                style={{
                  width: isVisible ? 20 : 8, height: 8,
                  borderRadius: 4, border: "none",
                  background: isVisible ? "#6EE7B7" : "var(--border)",
                  cursor: "pointer", padding: 0, transition: "all .2s", flexShrink: 0,
                }}
              />
            );
          })}
        </div>

        <NavArrow dir="right" enabled={idx < maxStart} onClick={goRight} />
      </div>

      {/* Calendar body */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Gutter: header spacer height matches day column header (56px) */}
        <div style={{ width: GUTTER_W, flexShrink: 0 }}>
          <div style={{ height: 56, borderBottom: "1px solid var(--border)" }} />
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
      style={{
        width: 32, height: 32, borderRadius: 8, border: "1px solid var(--border)",
        background: enabled ? "var(--surface-2)" : "transparent",
        color: enabled ? "var(--text-primary)" : "var(--border)",
        cursor: enabled ? "pointer" : "default",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 18, fontWeight: 300, flexShrink: 0,
        transition: "background .15s, color .15s",
      }}
    >
      {dir === "left" ? "‹" : "›"}
    </button>
  );
}
