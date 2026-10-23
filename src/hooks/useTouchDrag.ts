import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import type { CalendarEvent } from "@/types";

const HOLD_MS = 350;
const MOVE_TOLERANCE = 10;
const EDGE_PX = 28;
const EDGE_HOLD_MS = 550;
const SCROLL_TOP_ZONE = 72;
const SCROLL_BOTTOM_ZONE = 120;
const SCROLL_STEP = 9;

export interface TouchPoint {
  x: number;
  y: number;
}

interface TouchDragOptions<Hit extends { dayId: string }> {
  // Presses start inside this element; it must be mounted before the first touch.
  surface: RefObject<HTMLElement | null>;
  enabled: boolean;
  // The drop target under the finger, in viewport coordinates.
  locate: (p: TouchPoint) => Hit | null;
  // The hold became a drag of `block` (the pressed element); `at` is where the finger went down.
  onStart: (ev: CalendarEvent, fromDayId: string, block: HTMLElement, at: TouchPoint) => void;
  onEnter: (dayId: string) => void;
  onMove?: (hit: Hit) => void;
  // Every finger move while dragging, over a target or not.
  onPoint?: (p: TouchPoint) => void;
  onDrop: (hit: Hit, ev: CalendarEvent, fromDayId: string) => void;
  onCancel: () => void;
  // Holding the finger near a horizontal edge pages the view one day.
  paging?: {
    edges: () => { left: number; right: number } | null;
    onEdge: (dir: -1 | 1) => void;
  };
}

// WebKit fixes at touchstart whether a touch's moves can be cancelled, from the non-passive
// listeners already under the finger; the ones startPress adds would come too late.
function keepMovesCancelable() {}

// Long-press drag for touch screens, where HTML5 drag and drop doesn't work.
export function useTouchDrag<Hit extends { dayId: string }>(options: TouchDragOptions<Hit>) {
  const ref = useRef(options);
  useEffect(() => { ref.current = options; });
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  useEffect(() => () => cleanupRef.current?.(), []);

  const { surface, enabled } = options;
  useEffect(() => {
    const el = surface.current;
    if (!enabled || !el) return;
    el.addEventListener("touchmove", keepMovesCancelable, { passive: false });
    return () => el.removeEventListener("touchmove", keepMovesCancelable);
  }, [surface, enabled]);

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
    let last: Hit | null = null;
    let edgeDir: -1 | 0 | 1 = 0;
    let edgeTimer: ReturnType<typeof setTimeout> | null = null;
    let raf = 0;

    function update() {
      const hit = ref.current.locate(point);
      if (hit) {
        if (hit.dayId !== last?.dayId) ref.current.onEnter(hit.dayId);
        last = hit;
        ref.current.onMove?.(hit);
      }
      const edges = ref.current.paging?.edges() ?? null;
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
        ref.current.paging?.onEdge(edgeDir);
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
      ref.current.onStart(ev, dayId, block, t0);
      setDraggingId(ev.id);
      update();
      raf = requestAnimationFrame(autoScroll);
    }, HOLD_MS);

    function onMove(te: TouchEvent) {
      const t = te.touches[0];
      if (!t) return;
      if (!active) {
        // An uncancelable move means the browser has already taken the touch as a scroll.
        if (!te.cancelable || Math.hypot(t.clientX - t0.x, t.clientY - t0.y) > MOVE_TOLERANCE) cleanup();
        return;
      }
      if (te.cancelable) te.preventDefault();
      point = { x: t.clientX, y: t.clientY };
      ref.current.onPoint?.(point);
      update();
    }

    function onEnd(te: TouchEvent) {
      if (active) {
        // No synthetic click (it would open the detail), and swipe handlers above
        // must not take the drop for a swipe.
        te.preventDefault();
        te.stopPropagation();
        if (last) ref.current.onDrop(last, ev, dayId);
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
