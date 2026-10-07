import { useEffect, useRef, useState } from "react";
import { HOUR_START, PX_PER_HOUR } from "@/constants/time";
import { cssZoom } from "@/utils/zoom";
import type { CalendarEvent } from "@/types";

const HOLD_MS = 350;
const MOVE_TOLERANCE = 10;
const EDGE_PX = 28;
const EDGE_HOLD_MS = 550;
const SCROLL_TOP_ZONE = 72;
const SCROLL_BOTTOM_ZONE = 120;
const SCROLL_STEP = 9;

interface TouchDragHandlers {
  onStart: (ev: CalendarEvent, fromDayId: string, grabOffsetHours: number) => void;
  onEnter: (dayId: string) => void;
  onMove: (dayId: string, cursorHour: number) => void;
  onDrop: (dayId: string, droppedHour: number) => void;
  onCancel: () => void;
  // Holding the finger near a horizontal edge pages the calendar one day.
  onEdge: (dir: -1 | 1) => void;
  getEdges: () => { left: number; right: number } | null;
}

// Day grids are tagged with data-day-grid={day.id}. x is clamped into the
// columns so a finger resting over the hour gutter still targets a day.
function locate(x: number, y: number, edges: { left: number; right: number } | null) {
  const cx = edges ? Math.min(Math.max(x, edges.left + 1), edges.right - 1) : x;
  const grid = document.elementFromPoint(cx, y)?.closest<HTMLElement>("[data-day-grid]");
  if (!grid?.dataset.dayGrid) return null;
  const rect = grid.getBoundingClientRect();
  const gridStart = Number(grid.dataset.gridStart ?? HOUR_START);
  return { dayId: grid.dataset.dayGrid, hour: gridStart + (y - rect.top) / (PX_PER_HOUR * cssZoom(grid)) };
}

// Long-press drag for touch screens, where HTML5 drag and drop doesn't work.
// Feeds the same useDragDrop pipeline (ghost preview, snap, undo toast).
export function useTouchDrag(handlers: TouchDragHandlers) {
  const ref = useRef(handlers);
  useEffect(() => { ref.current = handlers; });
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  useEffect(() => () => cleanupRef.current?.(), []);

  function startPress(e: React.TouchEvent<HTMLElement>, ev: CalendarEvent, dayId: string) {
    if (e.touches.length !== 1) return;
    cleanupRef.current?.();

    // Listeners go on the touched node, not window: when paging days unmounts
    // the source column, touch events keep firing on the detached target only.
    const target = e.target as HTMLElement;
    const block = e.currentTarget;
    const t0 = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    let point = t0;
    let active = false;
    let last: { dayId: string; hour: number } | null = null;
    let edgeDir: -1 | 0 | 1 = 0;
    let edgeTimer: ReturnType<typeof setTimeout> | null = null;
    let raf = 0;

    function update() {
      const edges = ref.current.getEdges();
      const hit = locate(point.x, point.y, edges);
      if (hit) {
        if (hit.dayId !== last?.dayId) ref.current.onEnter(hit.dayId);
        last = hit;
        ref.current.onMove(hit.dayId, hit.hour);
      }
      const dir = !edges ? 0 : point.x < edges.left + EDGE_PX ? -1 : point.x > edges.right - EDGE_PX ? 1 : 0;
      if (dir !== edgeDir) {
        edgeDir = dir;
        if (edgeTimer) clearTimeout(edgeTimer);
        edgeTimer = null;
        if (dir) armEdge();
      }
    }

    function armEdge() {
      edgeTimer = setTimeout(() => {
        if (!edgeDir) return;
        ref.current.onEdge(edgeDir);
        setTimeout(update, 60);
        armEdge();
      }, EDGE_HOLD_MS);
    }

    function autoScroll() {
      const dy = point.y < SCROLL_TOP_ZONE ? -SCROLL_STEP
        : point.y > window.innerHeight - SCROLL_BOTTOM_ZONE ? SCROLL_STEP : 0;
      if (dy) {
        window.scrollBy(0, dy);
        update();
      }
      raf = requestAnimationFrame(autoScroll);
    }

    const holdTimer = setTimeout(() => {
      active = true;
      navigator.vibrate?.(12);
      const rect = block.getBoundingClientRect();
      const grab = (t0.y - rect.top) / (PX_PER_HOUR * cssZoom(block));
      ref.current.onStart(ev, dayId, grab);
      setDraggingId(ev.id);
      update();
      raf = requestAnimationFrame(autoScroll);
    }, HOLD_MS);

    function onMove(te: TouchEvent) {
      const t = te.touches[0];
      if (!t) return;
      if (!active) {
        if (Math.hypot(t.clientX - t0.x, t.clientY - t0.y) > MOVE_TOLERANCE) cleanup();
        return;
      }
      te.preventDefault();
      point = { x: t.clientX, y: t.clientY };
      update();
    }

    function onEnd(te: TouchEvent) {
      if (active) {
        // Swallow the synthetic click so dropping doesn't also open the editor.
        te.preventDefault();
        if (last) ref.current.onDrop(last.dayId, last.hour);
        else ref.current.onCancel();
      }
      cleanup();
    }

    function onCancel() {
      if (active) ref.current.onCancel();
      cleanup();
    }

    function cleanup() {
      clearTimeout(holdTimer);
      if (edgeTimer) clearTimeout(edgeTimer);
      cancelAnimationFrame(raf);
      target.removeEventListener("touchmove", onMove);
      target.removeEventListener("touchend", onEnd);
      target.removeEventListener("touchcancel", onCancel);
      cleanupRef.current = null;
      setDraggingId(null);
    }

    target.addEventListener("touchmove", onMove, { passive: false });
    target.addEventListener("touchend", onEnd, { passive: false });
    target.addEventListener("touchcancel", onCancel);
    cleanupRef.current = cleanup;
  }

  return { draggingId, startPress };
}
