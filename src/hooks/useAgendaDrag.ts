import { useRef, useState } from "react";
import { useTouchDrag, type TouchPoint } from "@/hooks/useTouchDrag";
import { moveStartHour } from "@/utils/tripDays";
import { cssZoom } from "@/utils/zoom";
import type { CalendarEvent, Day } from "@/types";

// The part of useDragDrop a touch drag goes through; its drop ends in the shared move + "Deshacer".
export interface AgendaDragApi {
  beginDrag: (ev: CalendarEvent, fromDayId: string, grabOffsetHours: number) => void;
  onDragEnter: (dayId: string) => void;
  onDropInDay: (dayId: string, droppedHour: number) => void;
  cancelDrag: () => void;
  dragTarget: string | null;
}

// The lifted row's box in CSS pixels, where the finger went down and the zoom they were measured in.
export interface AgendaLift {
  ev: CalendarEvent;
  fromDayId: string;
  left: number;
  top: number;
  width: number;
  at: TouchPoint;
  zoom: number;
}

function dayCardAt({ x, y }: TouchPoint) {
  const dayId = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-agenda-day]")?.dataset.agendaDay;
  return dayId ? { dayId } : null;
}

// Long-press an activity of the phone Agenda and drop it on another day card: it keeps its hours
// there, or takes the next free hour when they collide (moveStartHour).
export function useAgendaDrag(days: Day[], drag: AgendaDragApi | undefined, enabled: boolean) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [lift, setLift] = useState<AgendaLift | null>(null);
  const liftRef = useRef<AgendaLift | null>(null);
  const pointRef = useRef<TouchPoint | null>(null);
  const ghostRef = useRef<HTMLDivElement | null>(null);

  function placeGhost() {
    const el = ghostRef.current;
    const l = liftRef.current;
    const p = pointRef.current;
    if (!el || !l || !p) return;
    el.style.transform = `translate3d(0, ${(p.y - l.at.y) / l.zoom}px, 0)`;
  }

  function end() {
    liftRef.current = null;
    pointRef.current = null;
    setLift(null);
  }

  const on = enabled && !!drag;
  const touchDrag = useTouchDrag({
    surface: surfaceRef,
    enabled: on,
    locate: dayCardAt,
    onStart: (ev, fromDayId, block, at) => {
      drag?.beginDrag(ev, fromDayId, 0);
      const r = block.getBoundingClientRect();
      const zoom = cssZoom(block);
      liftRef.current = { ev, fromDayId, left: r.left / zoom, top: r.top / zoom, width: r.width / zoom, at, zoom };
      pointRef.current = at;
      setLift(liftRef.current);
    },
    onEnter: (dayId) => drag?.onDragEnter(dayId),
    onPoint: (p) => {
      pointRef.current = p;
      placeGhost();
    },
    onDrop: ({ dayId }, ev, fromDayId) => {
      const day = days.find((d) => d.id === dayId);
      if (day && dayId !== fromDayId) drag?.onDropInDay(dayId, moveStartHour(ev, day));
      else drag?.cancelDrag();
      end();
    },
    onCancel: () => {
      drag?.cancelDrag();
      end();
    },
  });

  return {
    surfaceRef,
    lift,
    liftedId: touchDrag.draggingId,
    // The card the activity would land on; its own day doesn't light up.
    overDayId: lift && drag?.dragTarget !== lift.fromDayId ? drag?.dragTarget ?? null : null,
    startPress: on ? touchDrag.startPress : undefined,
    bindGhost: (el: HTMLDivElement | null) => {
      ghostRef.current = el;
      placeGhost();
    },
  };
}
