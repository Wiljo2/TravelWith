import { useRef, useState } from "react";
import { snapHour } from "../utils/time";
import { HOUR_START, HOUR_END } from "../constants/time";

export function useDragDrop(onDrop) {
  const dragData  = useRef(null);
  const [dragTarget,  setDragTarget]  = useState(null);
  const [dragPreview, setDragPreview] = useState(null); // { dayId, newStart, newEnd, cat }

  function onDragStart(e, ev, fromDayId, grabOffsetHours = 0) {
    dragData.current = { ev, fromDayId, grabOffsetHours };
    e.dataTransfer.effectAllowed = "move";
  }

  function onDragEnter(dayId) {
    setDragTarget(dayId);
  }

  // called from DayColumn's onDragOver with the cursor hour (already in hour units)
  function onDragMove(dayId, cursorHour) {
    const data = dragData.current;
    if (!data) return;
    const { ev, grabOffsetHours } = data;
    const dur = ev.end - ev.start;
    const newStart = snapHour(cursorHour - grabOffsetHours, dur, HOUR_START, HOUR_END);
    setDragPreview({ dayId, newStart, newEnd: newStart + dur, ev });
  }

  function onDropInDay(dayId, droppedHour) {
    const data = dragData.current;
    if (!data) return;
    const hourAtBlockTop = droppedHour - data.grabOffsetHours;
    onDrop(data.fromDayId, dayId, data.ev, hourAtBlockTop);
    setDragTarget(null);
    setDragPreview(null);
    dragData.current = null;
  }

  function onDragEnd() {
    setDragTarget(null);
    setDragPreview(null);
    dragData.current = null;
  }

  return { onDragStart, onDragEnter, onDragMove, onDropInDay, onDragEnd, dragTarget, dragPreview };
}
