import { useState } from "react";
import { CATEGORIES } from "../../constants/categories";
import { HOUR_START, PX_PER_HOUR } from "../../constants/time";
import { fmtHour, durLabel } from "../../utils/time";

// Shared card renderer used by both real blocks and the drag ghost
export function EventCard({ ev, start, end, height, selected, cat, style = {} }) {
  const punctual = end <= start;
  return (
    <div
      style={{
        background: cat.bg,
        border: `1px solid ${cat.border}`,
        borderLeft: `4px solid ${cat.border}`,
        borderRadius: 8,
        padding: "5px 8px",
        overflow: "hidden",
        height: "100%",
        boxShadow: selected ? `0 0 0 2px ${cat.border}` : "none",
        ...style,
      }}
    >
      <div
        style={{
          fontSize: 12.5,
          fontWeight: 500,
          color: cat.text,
          lineHeight: 1.25,
          whiteSpace: height < 40 ? "nowrap" : "normal",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {ev.title}
      </div>
      {height >= 40 && (
        <div style={{ fontSize: 11, color: cat.border, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>
          {punctual ? fmtHour(start) : `${fmtHour(start)} – ${fmtHour(end)}`}
          {!punctual && ` · ${durLabel(start, end)}`}
        </div>
      )}
      {height >= 64 && ev.note && (
        <div style={{ fontSize: 11, color: cat.text, opacity: 0.75, marginTop: 3, lineHeight: 1.3 }}>
          {ev.note}
        </div>
      )}
    </div>
  );
}

// Invisible 1×1 gif used to suppress the browser's native drag ghost
const EMPTY_IMG = new Image();
EMPTY_IMG.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

export default function EventBlock({ ev, dayId, onDragStart, onDragEnd, onSelect, selected }) {
  const [dragging, setDragging] = useState(false);
  const cat    = CATEGORIES[ev.cat] || CATEGORIES.logist;
  const top    = (ev.start - HOUR_START) * PX_PER_HOUR;
  const rawH   = (ev.end - ev.start) * PX_PER_HOUR;
  const height = Math.max(rawH, 26);

  return (
    <div
      draggable
      onDragStart={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const grabOffsetHours = (e.clientY - rect.top) / PX_PER_HOUR;
        // hide browser's drag image so only our ghost is visible
        e.dataTransfer.setDragImage(EMPTY_IMG, 0, 0);
        onDragStart(e, ev, dayId, grabOffsetHours);
        setDragging(true);
      }}
      onDragEnd={(e) => {
        onDragEnd?.(e);
        setDragging(false);
      }}
      onClick={(e) => { e.stopPropagation(); onSelect(ev.id); }}
      style={{
        position: "absolute",
        top,
        left: 6,
        right: 6,
        height,
        cursor: "grab",
        userSelect: "none",
        // disappear while dragging — the ghost takes over visually
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
      />
    </div>
  );
}
