"use client";
import { useState } from "react";
import type { CSSProperties } from "react";
import { CATEGORIES } from "@/constants/categories";
import { PX_PER_HOUR } from "@/constants/time";
import { useGridStart } from "./gridStart";
import { fmtHour, durLabel } from "@/utils/time";
import { cssZoom } from "@/utils/zoom";
import { eventIcon } from "@/utils/itemIcon";
import { cn } from "@/lib/utils";
import type { CalendarEvent, Category } from "@/types";

const CONFLICT_CAT: Category = {
  label:  "Conflicto",
  bg:     "rgba(239,68,68,.10)",
  border: "#EF4444",
  text:   "#7F1D1D",
  dot:    "#EF4444",
};

interface EventCardProps {
  ev: CalendarEvent;
  start: number;
  end: number;
  height: number;
  selected: boolean;
  cat: Category;
  conflict?: boolean;
  style?: CSSProperties;
}

// Shared card renderer used by both real blocks and the drag ghost.
// Category colors are data-driven, so they stay as inline styles.
export function EventCard({ ev, start, end, height, selected, cat, conflict, style = {} }: EventCardProps) {
  const c = conflict ? CONFLICT_CAT : cat;
  const punctual = end <= start;
  return (
    <div
      className="h-full overflow-hidden rounded-lg px-2 py-1"
      style={{
        background: c.bg,
        borderLeft: `3px solid ${conflict ? c.border : c.dot}`,
        boxShadow: selected
          ? `0 0 0 2px ${c.border}`
          : conflict
            ? `inset 0 0 0 1px ${c.border}, 0 1px 4px rgba(239,68,68,.18)`
            : "0 1px 2px rgba(0,0,0,.05)",
        ...style,
      }}
    >
      {conflict && (
        <div className="mb-px inline-block text-[9px] font-bold tracking-[.04em] text-destructive">
          ⚠ CONFLICTO
        </div>
      )}
      <div
        className={cn("overflow-hidden text-ellipsis text-xs font-medium leading-tight", height < 40 && "whitespace-nowrap")}
        style={{ color: c.text }}
      >
        <span aria-hidden className="mr-1">{eventIcon(ev)}</span>{ev.title}
      </div>
      {height >= 40 && (
        <div className="mt-0.5 text-[10.5px] tabular-nums" style={{ color: c.border }}>
          {punctual ? fmtHour(start) : `${fmtHour(start)} – ${fmtHour(end)}`}
          {!punctual && ` · ${durLabel(start, end)}`}
        </div>
      )}
      {height >= 64 && ev.note && (
        <div className="mt-[3px] text-[10.5px] leading-snug opacity-70" style={{ color: c.text }}>
          {ev.note}
        </div>
      )}
    </div>
  );
}

// Lazy singleton — only created in the browser to avoid SSR crash
let _emptyImg: HTMLImageElement | null = null;
function getEmptyImg(): HTMLImageElement {
  if (!_emptyImg) {
    _emptyImg = new Image();
    _emptyImg.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
  }
  return _emptyImg;
}

interface EventBlockProps {
  ev: CalendarEvent;
  dayId: string;
  col: number;
  total: number;
  conflict: boolean;
  onDragStart: (e: React.DragEvent, ev: CalendarEvent, dayId: string, grabOffsetHours: number) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  onSelect: (id: string | null) => void;
  selected: boolean;
  onMouseEnter?: () => void;
  onMouseLeave?: (e: React.MouseEvent) => void;
  // Set on touch screens: long-press drag replaces HTML5 drag and drop.
  onTouchPress?: (e: React.TouchEvent<HTMLElement>, ev: CalendarEvent, dayId: string) => void;
  touchDragging?: boolean;
}

export default function EventBlock({
  ev, dayId, col, total, conflict,
  onDragStart, onDragEnd, onSelect, selected,
  onMouseEnter, onMouseLeave, onTouchPress, touchDragging,
}: EventBlockProps) {
  const [dragging, setDragging] = useState(false);
  const gridStart = useGridStart();
  const cat    = CATEGORIES[ev.cat] ?? CATEGORIES.logist;
  const top    = (ev.start - gridStart) * PX_PER_HOUR;
  const rawH   = (ev.end - ev.start) * PX_PER_HOUR;
  const height = Math.max(rawH, 26);

  // Single events: 85% width centered; conflicts: side-by-side with 2px gaps
  const GAP   = 2;
  const INSET = 6;
  const slotW = total === 1
    ? "85%"
    : `calc((100% - ${INSET * 2 + GAP * (total - 1)}px) / ${total})`;
  const slotL = total === 1
    ? "7.5%"
    : `calc(${INSET}px + ${col} * ((100% - ${INSET * 2 + GAP * (total - 1)}px) / ${total} + ${GAP}px))`;

  return (
    <div
      draggable={!onTouchPress}
      onTouchStart={onTouchPress && ((e) => onTouchPress(e, ev, dayId))}
      onContextMenu={onTouchPress && ((e) => e.preventDefault())}
      onDragStart={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const grabOffsetHours = (e.clientY - rect.top) / (PX_PER_HOUR * cssZoom(e.currentTarget));
        e.dataTransfer.setDragImage(getEmptyImg(), 0, 0);
        onDragStart(e, ev, dayId, grabOffsetHours);
        setDragging(true);
      }}
      onDragEnd={(e) => {
        onDragEnd?.(e);
        setDragging(false);
      }}
      onClick={(e) => { e.stopPropagation(); onSelect(ev.id); }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={cn(
        "absolute cursor-grab select-none transition-opacity duration-[80ms] [-webkit-touch-callout:none]",
        dragging || touchDragging ? "opacity-0" : "opacity-100",
      )}
      style={{ top, left: slotL, width: slotW, height }}
      title={onTouchPress ? undefined : "Arrastra para mover · clic para editar"}
    >
      <EventCard
        ev={ev}
        start={ev.start}
        end={ev.end}
        height={height}
        selected={selected}
        cat={cat}
        conflict={conflict}
      />
    </div>
  );
}
