import { useRef, useState } from "react";
import { snapHour } from "../utils/time";
import { HOUR_START, HOUR_END } from "../constants/time";
import type { CalendarEvent, DragPreview } from "../types";

interface DragData {
  ev: CalendarEvent;
  fromDayId: string;
  grabOffsetHours: number;
}

export function useDragDrop(onDrop: (fromDayId: string, toDayId: string, ev: CalendarEvent, droppedHour: number) => void): {
  onDragStart: (e: React.DragEvent, ev: CalendarEvent, fromDayId: string, grabOffsetHours: number) => void;
  onDragEnter: (dayId: string) => void;
  onDragMove: (dayId: string, cursorHour: number) => void;
  onDropInDay: (dayId: string, droppedHour: number) => void;
  onDragEnd: (e: React.DragEvent) => void;
  dragTarget: string | null;
  dragPreview: DragPreview | null;
} {
  const dragData = useRef<DragData | null>(null);
  const [dragTarget, setDragTarget] = useState<string | null>(null);
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null);

  function onDragStart(e: React.DragEvent, ev: CalendarEvent, fromDayId: string, grabOffsetHours = 0) {
    dragData.current = { ev, fromDayId, grabOffsetHours };
    e.dataTransfer.effectAllowed = "move";
  }

  function onDragEnter(dayId: string) {
    setDragTarget(dayId);
  }

  // called from DayColumn's onDragOver with the cursor hour (already in hour units)
  function onDragMove(dayId: string, cursorHour: number) {
    const data = dragData.current;
    if (!data) return;
    const { ev, grabOffsetHours } = data;
    const dur = ev.end - ev.start;
    const newStart = snapHour(cursorHour - grabOffsetHours, dur, HOUR_START, HOUR_END);
    setDragPreview({ dayId, newStart, newEnd: newStart + dur, ev });
  }

  function onDropInDay(dayId: string, droppedHour: number) {
    const data = dragData.current;
    if (!data) return;
    const hourAtBlockTop = droppedHour - data.grabOffsetHours;
    onDrop(data.fromDayId, dayId, data.ev, hourAtBlockTop);
    setDragTarget(null);
    setDragPreview(null);
    dragData.current = null;
  }

  function onDragEnd(_e: React.DragEvent) {
    setDragTarget(null);
    setDragPreview(null);
    dragData.current = null;
  }

  return { onDragStart, onDragEnter, onDragMove, onDropInDay, onDragEnd, dragTarget, dragPreview };
}
