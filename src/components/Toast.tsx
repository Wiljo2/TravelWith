import { useEffect, useRef } from "react";
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
      style={{
        position: "fixed",
        bottom: 24,
        left: "50%",
        transform: `translateX(-50%) translateY(${action ? 0 : 80}px)`,
        opacity: action ? 1 : 0,
        transition: "transform .22s cubic-bezier(.2,.8,.4,1), opacity .18s ease",
        pointerEvents: action ? "auto" : "none",
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        gap: 16,
        background: "#1F1E1B",
        color: "#F7F6F2",
        borderRadius: 10,
        padding: "12px 16px 12px 18px",
        boxShadow: "0 6px 24px rgba(0,0,0,.28)",
        fontSize: 13,
        whiteSpace: "nowrap",
      }}
    >
      {action && (
        <>
          <span>
            <strong style={{ fontWeight: 600 }}>{action.title}</strong>
            {" movida · "}
            <span style={{ fontVariantNumeric: "tabular-nums", opacity: .8 }}>
              {fmtHour(action.newStart)} – {fmtHour(action.newEnd)}
            </span>
          </span>

          <button
            onClick={onUndo}
            style={{
              background: "none",
              border: "none",
              color: "#6EE7B7",
              fontWeight: 600,
              fontSize: 13,
              cursor: "pointer",
              padding: "2px 4px",
              borderRadius: 4,
            }}
          >
            Deshacer
          </button>

          <button
            onClick={onDismiss}
            style={{
              background: "none",
              border: "none",
              color: "#888780",
              fontSize: 16,
              lineHeight: 1,
              cursor: "pointer",
              padding: "2px 4px",
              borderRadius: 4,
            }}
            aria-label="Cerrar"
          >
            ×
          </button>
        </>
      )}
    </div>
  );
}
