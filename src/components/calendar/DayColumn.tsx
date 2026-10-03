import { useRef, useState } from "react";
import { HOUR_START, HOUR_END, PX_PER_HOUR } from "@/constants/time";
import { CATEGORIES } from "@/constants/categories";
import { snapHour, fmtHour } from "@/utils/time";
import { cssZoom } from "@/utils/zoom";
import { EventCard } from "./EventBlock";
import EventBlock from "./EventBlock";
import TaskBlock from "./TaskBlock";
import DaySubtitle from "@/components/itinerary/DaySubtitle";
import { cn } from "@/lib/utils";
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
    <div className="pointer-events-none absolute inset-x-1.5 rounded-lg shadow-[0_4px_16px_rgba(0,0,0,.18)]" style={{ top, height }}>
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
  onSwapDays: (aId: string, bId: string) => void;
  onSetDaySub: (dayId: string, sub: string) => void;
  selectedId: string | null;
  isDragTarget: boolean;
  dragPreview: DragPreview | null;
  pendingHour: number | null;
  onTouchPress?: (e: React.TouchEvent<HTMLElement>, ev: CalendarEvent, dayId: string) => void;
  touchDraggingId?: string | null;
}

const DAY_SWAP_MIME = "application/x-day-swap";

export default function DayColumn({
  day, tasks, onDragStart, onDragEnter, onDragMove, onDrop, onDragEnd,
  onSelect, onAddEvent, onToggleTask, onEditTask, onSwapDays, onSetDaySub, selectedId, isDragTarget, dragPreview, pendingHour,
  onTouchPress, touchDraggingId,
}: DayColumnProps) {
  const touch = !!onTouchPress;
  const totalHeight = (HOUR_END - HOUR_START + 1) * PX_PER_HOUR;
  const colRef  = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const [hoverY, setHoverY] = useState<number | null>(null);
  const [swapOver, setSwapOver] = useState(false);
  // Typing in the subtitle must not start a day swap.
  const [editingSub, setEditingSub] = useState(false);

  function getHour(clientY: number) {
    const el = colRef.current!;
    const rect = el.getBoundingClientRect();
    return HOUR_START + (clientY - rect.top) / (PX_PER_HOUR * cssZoom(el));
  }

  const hoverHour = hoverY !== null ? snapHour(hoverY, 1, HOUR_START, HOUR_END) : null;

  return (
    <div className="flex min-w-0 flex-1 flex-col">

      {/* Header: fixed 56px so all grid lines align across columns.
          Draggable onto another day header to swap the two days' contents (mouse only). */}
      <div
        draggable={!touch && !editingSub}
        onDragStart={(e) => {
          e.dataTransfer.setData(DAY_SWAP_MIME, day.id);
          e.dataTransfer.effectAllowed = "move";
        }}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes(DAY_SWAP_MIME)) { e.preventDefault(); setSwapOver(true); }
        }}
        onDragLeave={() => setSwapOver(false)}
        onDrop={(e) => {
          setSwapOver(false);
          const sourceId = e.dataTransfer.getData(DAY_SWAP_MIME);
          if (sourceId && sourceId !== day.id) { e.preventDefault(); onSwapDays(sourceId, day.id); }
        }}
        title={touch ? undefined : "Arrastra este día sobre otro para intercambiar sus actividades"}
        className={cn(
          "box-border h-14 shrink-0 overflow-hidden border-b border-border bg-secondary px-2.5 py-2",
          !touch && "cursor-grab active:cursor-grabbing",
          swapOver && "bg-primary/15 ring-2 ring-inset ring-primary",
        )}
      >
        <div className="truncate text-[13px] font-medium text-foreground">
          {!touch && <span className="mr-1 opacity-40">⇄</span>}{day.label}
        </div>
        <DaySubtitle
          value={day.sub ?? ""}
          onCommit={(sub) => onSetDaySub(day.id, sub)}
          onEditingChange={setEditingSub}
          compact
          className="mt-0.5 text-[11px] text-secondary-foreground"
        />
      </div>

      {/* Time grid */}
      <div
        ref={colRef}
        data-day-grid={day.id}
        onDragOver={(e) => { e.preventDefault(); dragging.current = true; onDragMove(day.id, getHour(e.clientY)); }}
        onDragEnter={() => onDragEnter(day.id)}
        onDrop={(e) => { e.preventDefault(); dragging.current = false; onDrop(day.id, getHour(e.clientY)); }}
        onPointerMove={(e) => { if (e.pointerType === "mouse" && !dragging.current) setHoverY(getHour(e.clientY)); }}
        onPointerLeave={() => setHoverY(null)}
        onClick={(e) => {
          if (dragging.current) { dragging.current = false; return; }
          const h = snapHour(getHour(e.clientY), 1, HOUR_START, HOUR_END - 1);
          onAddEvent(day.id, h, e.clientX, e.clientY);
        }}
        className={cn("relative cursor-crosshair border-x border-border", isDragTarget ? "bg-[rgba(213,90,48,.04)]" : "bg-transparent")}
        style={{ height: totalHeight }}
      >
        {/* Hour lines */}
        {Array.from({ length: HOUR_END - HOUR_START + 1 }).map((_, i) => (
          <div key={i} className="absolute inset-x-0 h-px bg-border" style={{ top: i * PX_PER_HOUR }} />
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
            <div key={span.id} className="pointer-events-none absolute inset-x-0" style={{
              top, height,
              background: span.bg,
              borderTop:    hasBorder ? `1px dashed ${span.border}` : undefined,
              borderBottom: hasBorder ? `1px dashed ${span.border}` : undefined,
            }}>
              {span.label && hasBorder && (
                <span className="absolute right-1.5 top-[3px] select-none text-[9px] font-semibold uppercase tracking-[.05em] opacity-85" style={{ color: span.border }}>
                  {span.label}
                </span>
              )}
            </div>
          );
        })}

        {/* Hover indicator — shows where a click would add an event */}
        {hoverHour !== null && (
          <div className="pointer-events-none absolute inset-x-1 z-[5]" style={{ top: (hoverHour - HOUR_START) * PX_PER_HOUR }}>
            <div className="h-0.5 rounded-[1px] bg-primary opacity-70" />
            <span className="pointer-events-none absolute left-1 top-[3px] rounded-[3px] bg-background px-[3px] text-[10px] tabular-nums text-emerald-600">
              {fmtHour(hoverHour)}
            </span>
          </div>
        )}

        {/* Pending new event ghost */}
        {pendingHour !== null && (
          <div className="pointer-events-none absolute left-[7.5%] z-[4] w-[85%]" style={{ top: (pendingHour - HOUR_START) * PX_PER_HOUR, height: PX_PER_HOUR }}>
            <div className="flex h-full items-center justify-center gap-[5px] rounded-[7px] border-[1.5px] border-dashed border-[rgba(5,150,105,.55)] bg-[rgba(5,150,105,.06)]">
              <span className="text-[13px] font-light leading-none text-[rgba(5,150,105,.6)]">+</span>
              <span className="text-[10.5px] font-medium tracking-[.03em] text-[rgba(5,150,105,.55)]">nueva actividad</span>
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
                onMouseLeave={(e) => { if (!touch) setHoverY(getHour(e.clientY)); }}
                onTouchPress={onTouchPress}
                touchDragging={touchDraggingId === ev.id}
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
