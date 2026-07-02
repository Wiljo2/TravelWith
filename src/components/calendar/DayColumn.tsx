import { useRef, useState } from "react";
import { HOUR_START, HOUR_END, PX_PER_HOUR } from "@/constants/time";
import { CATEGORIES } from "@/constants/categories";
import { snapHour, fmtHour } from "@/utils/time";
import { EventCard } from "./EventBlock";
import EventBlock from "./EventBlock";
import TaskBlock from "./TaskBlock";
import type { Day, CalendarEvent, DragPreview, DaySpan, Task } from "@/types";

// Computes side-by-side column layout for overlapping events (Google Calendar style)
function computeLayout(events: CalendarEvent[]): Map<string, { col: number; total: number; conflict: boolean }> {
  const layout = new Map<string, { col: number; total: number; conflict: boolean }>();
  if (events.length === 0) return layout;

  const sorted = [...events].sort((a, b) =>
    a.start !== b.start ? a.start - b.start : (b.end - b.start) - (a.end - a.start)
  );

  // Group into clusters of overlapping events
  const groups: CalendarEvent[][] = [];
  let cluster: CalendarEvent[] = [];
  let clusterEnd = -Infinity;

  for (const ev of sorted) {
    if (cluster.length === 0 || ev.start < clusterEnd) {
      cluster.push(ev);
      clusterEnd = Math.max(clusterEnd, ev.end);
    } else {
      groups.push(cluster);
      cluster = [ev];
      clusterEnd = ev.end;
    }
  }
  if (cluster.length > 0) groups.push(cluster);

  for (const group of groups) {
    const conflict = group.length > 1;
    const colEnds: number[] = [];
    const colOf = new Map<string, number>();

    for (const ev of group) {
      let col = colEnds.findIndex((end) => end <= ev.start);
      if (col === -1) col = colEnds.length;
      colEnds[col] = ev.end;
      colOf.set(ev.id, col);
    }

    const total = colEnds.length;
    for (const ev of group) {
      layout.set(ev.id, { col: colOf.get(ev.id)!, total, conflict });
    }
  }

  return layout;
}

// Resolves a span's actual start/end hours, falling back to explicit hours or HOUR_START/END
function resolveSpan(span: DaySpan, events: CalendarEvent[]) {
  let start = span.startHour ?? HOUR_START;
  let end   = span.endHour   ?? HOUR_END + 1;
  if (span.startEventId) {
    const ev = events.find((e) => e.id === span.startEventId);
    if (ev) start = ev.start;
  }
  if (span.endEventId) {
    const ev = events.find((e) => e.id === span.endEventId);
    if (ev) end = ev.end;
  }
  return { start, end };
}

function GhostBlock({ preview }: { preview: DragPreview }) {
  const { ev, newStart, newEnd } = preview;
  const cat    = CATEGORIES[ev.cat] ?? CATEGORIES.logist;
  const top    = (newStart - HOUR_START) * PX_PER_HOUR;
  const height = Math.max((newEnd - newStart) * PX_PER_HOUR, 26);
  return (
    <div style={{ position: "absolute", top, left: 6, right: 6, height, pointerEvents: "none", boxShadow: "0 4px 16px rgba(0,0,0,.18)", borderRadius: 8 }}>
      <EventCard ev={ev} start={newStart} end={newEnd} height={height} selected={false} cat={cat} />
    </div>
  );
}

interface DayColumnProps {
  day: Day;
  tasks: Task[];
  onDragStart: (e: React.DragEvent, ev: CalendarEvent, dayId: string, grabOffsetHours: number) => void;
  onDragEnter: (dayId: string) => void;
  onDragMove: (dayId: string, cursorHour: number) => void;
  onDrop: (dayId: string, droppedHour: number) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onSelect: (id: string | null) => void;
  onAddEvent: (dayId: string, atHour: number, x: number, y: number) => void;
  onToggleTask: (id: string) => void;
  onEditTask: (task: Task, x: number, y: number) => void;
  selectedId: string | null;
  isDragTarget: boolean;
  dragPreview: DragPreview | null;
  pendingHour: number | null;
}

export default function DayColumn({
  day, tasks, onDragStart, onDragEnter, onDragMove, onDrop, onDragEnd,
  onSelect, onAddEvent, onToggleTask, onEditTask, selectedId, isDragTarget, dragPreview, pendingHour,
}: DayColumnProps) {
  const totalHeight = (HOUR_END - HOUR_START + 1) * PX_PER_HOUR;
  const colRef  = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const [hoverY, setHoverY] = useState<number | null>(null);

  function getHour(clientY: number) {
    const rect = colRef.current!.getBoundingClientRect();
    return HOUR_START + (clientY - rect.top) / PX_PER_HOUR;
  }

  const hoverHour = hoverY !== null ? snapHour(hoverY, 1, HOUR_START, HOUR_END) : null;

  return (
    <div style={{ flex: "1 1 0", minWidth: 0, display: "flex", flexDirection: "column" }}>

      {/* ── Header: fixed 56px so all grid lines align across columns ── */}
      <div style={{
        height: 56, boxSizing: "border-box", padding: "8px 10px",
        borderBottom: "1px solid var(--border)",
        background: "var(--surface-1)",
        overflow: "hidden", flexShrink: 0,
      }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {day.label}
        </div>
        <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {day.sub}
        </div>
      </div>

      {/* ── Time grid ── */}
      <div
        ref={colRef}
        onDragOver={(e) => { e.preventDefault(); dragging.current = true; onDragMove(day.id, getHour(e.clientY)); }}
        onDragEnter={() => onDragEnter(day.id)}
        onDrop={(e) => { e.preventDefault(); dragging.current = false; onDrop(day.id, getHour(e.clientY)); }}
        onMouseMove={(e) => { if (!dragging.current) setHoverY(getHour(e.clientY)); }}
        onMouseLeave={() => setHoverY(null)}
        onClick={(e) => {
          if (dragging.current) { dragging.current = false; return; }
          const h = snapHour(getHour(e.clientY), 1, HOUR_START, HOUR_END - 1);
          onAddEvent(day.id, h, e.clientX, e.clientY);
        }}
        style={{
          position: "relative", height: totalHeight,
          background: isDragTarget ? "rgba(213,90,48,.04)" : "transparent",
          borderLeft: "1px solid var(--border)", borderRight: "1px solid var(--border)",
          cursor: "crosshair",
        }}
      >
        {/* Hour lines */}
        {Array.from({ length: HOUR_END - HOUR_START + 1 }).map((_, i) => (
          <div key={i} style={{ position: "absolute", top: i * PX_PER_HOUR, left: 0, right: 0, height: 1, background: "var(--border)" }} />
        ))}

        {/* Dynamic spans — sorted by zIndex (lower = painted first = further back).
            No explicit CSS z-index set: DOM order ensures spans stay behind events. */}
        {[...(day.spans ?? [])].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0)).map((span) => {
          const { start, end } = resolveSpan(span, day.events);
          const top    = (Math.max(start, HOUR_START) - HOUR_START) * PX_PER_HOUR;
          const bottom = (Math.min(end, HOUR_END + 1) - HOUR_START) * PX_PER_HOUR;
          const height = Math.max(0, bottom - top);
          const hasBorder = span.border && span.border !== "transparent";
          return (
            <div key={span.id} style={{
              position: "absolute", top, height, left: 0, right: 0,
              background: span.bg,
              borderTop:    hasBorder ? `1px dashed ${span.border}` : undefined,
              borderBottom: hasBorder ? `1px dashed ${span.border}` : undefined,
              pointerEvents: "none",
            }}>
              {span.label && hasBorder && (
                <span style={{ position: "absolute", top: 3, right: 6, fontSize: 9, fontWeight: 600, color: span.border, opacity: .85, letterSpacing: ".05em", textTransform: "uppercase", userSelect: "none" }}>
                  {span.label}
                </span>
              )}
            </div>
          );
        })}

        {/* Hover indicator — shows where a click would add an event */}
        {hoverHour !== null && (
          <div style={{ position: "absolute", top: (hoverHour - HOUR_START) * PX_PER_HOUR, left: 4, right: 4, pointerEvents: "none", zIndex: 5 }}>
            <div style={{ height: 2, background: "#6EE7B7", borderRadius: 1, opacity: .7 }} />
            <span style={{
              position: "absolute", left: 4, top: 3,
              fontSize: 10, color: "#6EE7B7", fontVariantNumeric: "tabular-nums",
              background: "var(--surface-0)", padding: "0 3px", borderRadius: 3,
              pointerEvents: "none",
            }}>
              {fmtHour(hoverHour)}
            </span>
          </div>
        )}

        {/* Pending new event ghost */}
        {pendingHour !== null && (
          <div style={{
            position: "absolute",
            top: (pendingHour - HOUR_START) * PX_PER_HOUR,
            left: "7.5%",
            width: "85%",
            height: PX_PER_HOUR,
            pointerEvents: "none",
            zIndex: 4,
          }}>
            <div style={{
              height: "100%",
              borderRadius: 7,
              border: "1.5px dashed rgba(5,150,105,.55)",
              background: "rgba(5,150,105,.06)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 5,
            }}>
              <span style={{ fontSize: 13, color: "rgba(5,150,105,.6)", fontWeight: 300, lineHeight: 1 }}>+</span>
              <span style={{ fontSize: 10.5, color: "rgba(5,150,105,.55)", fontWeight: 500, letterSpacing: ".03em" }}>nueva actividad</span>
            </div>
          </div>
        )}

        {/* Events — side-by-side when overlapping */}
        {(() => {
          const layout = computeLayout(day.events);
          return day.events.map((ev) => {
            const slot = layout.get(ev.id) ?? { col: 0, total: 1, conflict: false };
            return (
              <EventBlock
                key={ev.id}
                ev={ev}
                dayId={day.id}
                col={slot.col}
                total={slot.total}
                conflict={slot.conflict}
                onDragStart={(e, ev, dayId, offset) => { dragging.current = true; onDragStart(e, ev, dayId, offset); }}
                onDragEnd={(e) => { setTimeout(() => { dragging.current = false; }, 50); onDragEnd(e); }}
                onSelect={onSelect}
                selected={selectedId === ev.id}
                onMouseEnter={() => setHoverY(null)}
                onMouseLeave={(e) => setHoverY(getHour(e.clientY))}
              />
            );
          });
        })()}

        {tasks.map((task) => (
          <TaskBlock
            key={task.id}
            task={task}
            onToggle={() => onToggleTask(task.id)}
            onEdit={(x, y) => onEditTask(task, x, y)}
          />
        ))}

        {/* Drag ghost */}
        {dragPreview?.dayId === day.id && dragPreview && <GhostBlock preview={dragPreview} />}
      </div>
    </div>
  );
}
