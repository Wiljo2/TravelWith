"use client";
import { cn } from "@/lib/utils";
import type { Snack } from "@/hooks/useSnackbar";

interface SnackbarProps {
  snack: Snack | null;
  onDismiss: () => void;
}

export default function Snackbar({ snack, onDismiss }: SnackbarProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "fixed bottom-[calc(env(safe-area-inset-bottom)+76px)] left-1/2 z-[200] flex max-w-[calc(100vw-24px)] -translate-x-1/2 items-center gap-3 whitespace-nowrap rounded-[10px] bg-foreground py-3 pl-[18px] pr-3 text-[13px] text-background shadow-[0_6px_24px_rgba(0,0,0,.28)] transition-all duration-200 md:bottom-6 md:gap-4 md:pr-4",
        snack ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-20 opacity-0",
      )}
    >
      {snack && (
        <>
          <span className="min-w-0 truncate">{snack.message}</span>
          {snack.action && (
            <button
              onClick={() => {
                snack.action?.run();
                onDismiss();
              }}
              className="cursor-pointer rounded px-1 py-0.5 text-[13px] font-semibold text-primary"
            >
              {snack.action.label}
            </button>
          )}
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
