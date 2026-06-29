import HourGutter from "./HourGutter";
import DayColumn from "./DayColumn";
import type { Day, CalendarEvent, DragPreview } from "../../types";

interface CalendarGridProps {
  days: Day[];
  onDragStart: (e: React.DragEvent, ev: CalendarEvent, dayId: string, grabOffsetHours: number) => void;
  onDragEnter: (dayId: string) => void;
  onDragMove: (dayId: string, cursorHour: number) => void;
  onDrop: (dayId: string, droppedHour: number) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onSelect: (id: string | null) => void;
  selectedId: string | null;
  dragTarget: string | null;
  dragPreview: DragPreview | null;
  onAddEvent: (dayId: string) => void;
}

export default function CalendarGrid({
  days, onDragStart, onDragEnter, onDragMove, onDrop, onDragEnd,
  onSelect, selectedId, dragTarget, dragPreview, onAddEvent,
}: CalendarGridProps) {
  return (
    <div
      style={{
        flex: "1 1 0",
        minWidth: 0,
        overflowX: "auto",
        background: "var(--surface-2)",
        border: "1px solid var(--border)",
        borderRadius: 10,
      }}
    >
      <div style={{ display: "flex", minWidth: 900 }}>
        <div style={{ flexShrink: 0, width: 56 }}>
          <div style={{ minHeight: 56, borderBottom: "1px solid var(--border)" }} />
          <HourGutter />
        </div>

        {days.map((day) => (
          <div key={day.id} style={{ flex: "1 1 0", minWidth: 150 }}>
            <DayColumn
              day={day}
              onDragStart={onDragStart}
              onDragEnter={onDragEnter}
              onDragMove={onDragMove}
              onDrop={onDrop}
              onDragEnd={onDragEnd}
              onSelect={onSelect}
              selectedId={selectedId}
              isDragTarget={dragTarget === day.id}
              dragPreview={dragPreview}
            />
            <button
              onClick={() => onAddEvent(day.id)}
              style={{
                width: "100%",
                border: "none",
                borderTop: "1px solid var(--border)",
                background: "transparent",
                color: "var(--text-muted)",
                fontSize: 12,
                padding: "7px 0",
                cursor: "pointer",
              }}
            >
              + actividad
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
