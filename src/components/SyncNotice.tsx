"use client";
import { useEffect } from "react";

interface SyncNoticeProps {
  message: string | null;
  onDismiss: () => void;
}

// Short notice about a write that didn't go through as sent (conflict with
// another member, or a failed save that triggered a reload).
export default function SyncNotice({ message, onDismiss }: SyncNoticeProps) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onDismiss, 6000);
    return () => clearTimeout(timer);
  }, [message, onDismiss]);

  if (!message) return null;
  return (
    <div
      role="status"
      className="fixed left-1/2 top-4 z-[210] flex max-w-[90vw] -translate-x-1/2 items-center gap-3 rounded-lg border border-border bg-card px-4 py-2.5 text-[13px] text-foreground shadow-lg"
    >
      <span>{message}</span>
      <button onClick={onDismiss} className="cursor-pointer text-muted-foreground hover:text-foreground" aria-label="Cerrar">
        ×
      </button>
    </div>
  );
}
