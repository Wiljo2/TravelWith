"use client";
import { createPortal } from "react-dom";
import { EventRowBody } from "@/components/itinerary/agendaParts";
import type { AgendaLift } from "@/hooks/useAgendaDrag";

interface AgendaDragGhostProps {
  lift: AgendaLift;
  tips?: number;
  // Callback ref that moves the ghost with the finger without re-rendering the agenda.
  bind: (el: HTMLDivElement | null) => void;
}

// The lifted activity, raised above the page and following the finger to another day card.
export default function AgendaDragGhost({ lift, tips, bind }: AgendaDragGhostProps) {
  return createPortal(
    <div
      ref={bind}
      aria-hidden
      className="pointer-events-none fixed z-[60] will-change-transform"
      style={{ left: lift.left, top: lift.top, width: lift.width }}
    >
      <div className="flex scale-[1.03] items-start gap-3 rounded-lg bg-card px-2 py-2 shadow-[0_10px_30px_rgba(0,0,0,.18)] ring-1 ring-border duration-150 animate-in fade-in-0 zoom-in-95">
        <EventRowBody ev={lift.ev} tips={tips} />
      </div>
    </div>,
    document.body,
  );
}
