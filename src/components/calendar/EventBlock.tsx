import { useState } from "react";
import type { CSSProperties } from "react";
import { CATEGORIES } from "../../constants/categories";
import { HOUR_START, PX_PER_HOUR } from "../../constants/time";
import { fmtHour, durLabel } from "../../utils/time";
import type { CalendarEvent, Category } from "../../types";

// Conflict color scheme — warm red/orange to make overlaps unmistakable
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

// Shared card renderer used by both real blocks and the drag ghost
export function EventCard({ ev, start, end, height, selected, cat, conflict, style = {} }: EventCardProps) {
  const c = conflict ? CONFLICT_CAT : cat;
  const punctual = end <= start;
  return (
    <div
      style={{
        background: c.bg,
        border: `1px solid ${c.border}`,
        borderLeft: `3px solid ${c.border}`,
        borderRadius: 7,
        padding: "4px 7px",
        overflow: "hidden",
        height: "100%",
        boxShadow: selected
          ? `0 0 0 2px ${c.border}`
          : conflict
            ? `0 1px 4px rgba(239,68,68,.18)`
            : "none",
        ...style,
      }}
    >
      {conflict && (
        <div style={{
          display: "inline-block", fontSize: 9, fontWeight: 700,
          color: "#EF4444", letterSpacing: ".04em",
          marginBottom: 1,
        }}>
          ⚠ CONFLICTO
        </div>
      )}
      <div
        style={{
          fontSize: 12,
          fontWeight: 500,
          color: c.text,
          lineHeight: 1.25,
          whiteSpace: height < 40 ? "nowrap" : "normal",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {ev.title}
      </div>
      {height >= 40 && (
        <div style={{ fontSize: 10.5, color: c.border, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>
          {punctual ? fmtHour(start) : `${fmtHour(start)} – ${fmtHour(end)}`}
          {!punctual && ` · ${durLabel(start, end)}`}
        </div>
      )}
      {height >= 64 && ev.note && (
        <div style={{ fontSize: 10.5, color: c.text, opacity: 0.7, marginTop: 3, lineHeight: 1.3 }}>
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
}

export default function EventBlock({
  ev, dayId, col, total, conflict,
  onDragStart, onDragEnd, onSelect, selected,
  onMouseEnter, onMouseLeave,
}: EventBlockProps) {
  const [dragging, setDragging] = useState(false);
  const cat    = CATEGORIES[ev.cat] ?? CATEGORIES.logist;
  const top    = (ev.start - HOUR_START) * PX_PER_HOUR;
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
      draggable
      onDragStart={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const grabOffsetHours = (e.clientY - rect.top) / PX_PER_HOUR;
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
      style={{
        position: "absolute",
        top,
        left: slotL,
        width: slotW,
        height,
        cursor: "grab",
        userSelect: "none",
        opacity: dragging ? 0 : 1,
        transition: "opacity .08s",
      }}
      title="Arrastra para mover · clic para editar"
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
