"use client";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { fmtHour } from "@/utils/time";
import type { ToastAction } from "@/types";

interface ToastProps {
  action: ToastAction | null;
  onUndo: (() => void) | undefined;
  onDismiss: () => void;
}

export default function Toast({ action, onUndo, onDismiss }: ToastProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!action) return;
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(onDismiss, 5000);
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, [action, onDismiss]);

  return (
    <div
      className={cn(
        "fixed bottom-6 left-1/2 z-[200] flex -translate-x-1/2 items-center gap-4 whitespace-nowrap rounded-[10px] bg-[#1F1E1B] py-3 pl-[18px] pr-4 text-[13px] text-[#F7F6F2] shadow-[0_6px_24px_rgba(0,0,0,.28)] transition-all duration-200",
        action ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-20 opacity-0",
      )}
    >
      {action && (
        <>
          <span>
            <strong className="font-semibold">{action.title}</strong>
            {" movida · "}
            <span className="tabular-nums opacity-80">
              {fmtHour(action.newStart)} – {fmtHour(action.newEnd)}
            </span>
          </span>

          <button
            onClick={onUndo}
            className="cursor-pointer rounded px-1 py-0.5 text-[13px] font-semibold text-primary"
          >
            Deshacer
          </button>

          <button
            onClick={onDismiss}
            className="cursor-pointer rounded px-1 py-0.5 text-base leading-none text-muted-foreground"
            aria-label="Cerrar"
          >
            ×
          </button>
        </>
      )}
    </div>
  );
}
