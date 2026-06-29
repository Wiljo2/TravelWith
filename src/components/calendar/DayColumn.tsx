import { useRef } from "react";
import { HOUR_START, HOUR_END, PX_PER_HOUR } from "../../constants/time";
import { CATEGORIES } from "../../constants/categories";
import { EventCard } from "./EventBlock";
import EventBlock from "./EventBlock";
import type { Day, CalendarEvent, DragPreview } from "../../types";

interface GhostBlockProps {
  preview: DragPreview;
}

function GhostBlock({ preview }: GhostBlockProps) {
  const { ev, newStart, newEnd } = preview;
  const cat    = CATEGORIES[ev.cat] ?? CATEGORIES.logist;
  const top    = (newStart - HOUR_START) * PX_PER_HOUR;
  const height = Math.max((newEnd - newStart) * PX_PER_HOUR, 26);

  return (
    <div
      style={{
        position: "absolute",
        top,
        left: 6,
        right: 6,
        height,
        pointerEvents: "none",
        // slightly lifted shadow so it feels "held"
        boxShadow: "0 4px 16px rgba(0,0,0,.18)",
        borderRadius: 8,
      }}
    >
      <EventCard
        ev={ev}
        start={newStart}
        end={newEnd}
        height={height}
        selected={false}
        cat={cat}
      />
    </div>
  );
}

interface DayColumnProps {
  day: Day;
  onDragStart: (e: React.DragEvent, ev: CalendarEvent, dayId: string, grabOffsetHours: number) => void;
  onDragEnter: (dayId: string) => void;
  onDragMove: (dayId: string, cursorHour: number) => void;
  onDrop: (dayId: string, droppedHour: number) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onSelect: (id: string) => void;
  selectedId: string | null;
  isDragTarget: boolean;
  dragPreview: DragPreview | null;
}

export default function DayColumn({ day, onDragStart, onDragEnter, onDragMove, onDrop, onDragEnd, onSelect, selectedId, isDragTarget, dragPreview }: DayColumnProps) {
  const totalHeight = (HOUR_END - HOUR_START + 1) * PX_PER_HOUR;
  const colRef = useRef<HTMLDivElement>(null);

  const getCursorHour = (clientY: number): number => {
    const rect = colRef.current!.getBoundingClientRect();
    return HOUR_START + (clientY - rect.top) / PX_PER_HOUR;
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    onDragMove(day.id, getCursorHour(e.clientY));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    onDrop(day.id, getCursorHour(e.clientY));
  };

  const showPreview = dragPreview?.dayId === day.id;

  return (
    <div style={{ flex: "1 1 0", minWidth: 150, display: "flex", flexDirection: "column" }}>
      {/* column header */}
      <div
        style={{
          padding: "8px 10px",
          borderBottom: "1px solid var(--border)",
          background: day.flexible ? "#FAECE7" : "var(--surface-1)",
          borderTopLeftRadius: 8,
          borderTopRightRadius: 8,
          minHeight: 56,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>
            {day.label}
          </span>
          {day.flexible && (
            <span style={{ fontSize: 9.5, fontWeight: 500, color: "#993C1D", background: "#F5C4B3", padding: "1px 6px", borderRadius: 20 }}>
              FLEXIBLE
            </span>
          )}
        </div>
        <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
          {day.sub}
        </div>
      </div>

      {/* time grid */}
      <div
        ref={colRef}
        onDragOver={handleDragOver}
        onDragEnter={() => onDragEnter(day.id)}
        onDrop={handleDrop}
        style={{
          position: "relative",
          height: totalHeight,
          background: isDragTarget ? "rgba(213,90,48,.04)" : "transparent",
          borderLeft: "1px solid var(--border)",
          borderRight: "1px solid var(--border)",
        }}
      >
        {/* hour lines */}
        {Array.from({ length: HOUR_END - HOUR_START + 1 }).map((_, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              top: i * PX_PER_HOUR,
              left: 0, right: 0, height: 1,
              background: "var(--border)",
            }}
          />
        ))}

        {/* port window shading */}
        {day.portWindow && (
          <div
            style={{
              position: "absolute",
              top: (day.portWindow[0] - HOUR_START) * PX_PER_HOUR,
              height: (day.portWindow[1] - day.portWindow[0]) * PX_PER_HOUR,
              left: 0, right: 0,
              background: "rgba(55,138,221,.06)",
              borderTop: "1px dashed #85B7EB",
              borderBottom: "1px dashed #85B7EB",
              pointerEvents: "none",
            }}
          />
        )}

        {/* real events */}
        {day.events.map((ev) => (
          <EventBlock
            key={ev.id}
            ev={ev}
            dayId={day.id}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onSelect={onSelect}
            selected={selectedId === ev.id}
          />
        ))}

        {/* drag ghost — full-fidelity preview that snaps in real time */}
        {showPreview && dragPreview && <GhostBlock preview={dragPreview} />}
      </div>
    </div>
  );
}
