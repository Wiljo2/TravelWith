"use client";
import { useState } from "react";
import { Check, Pencil, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface DaySubtitleProps {
  value: string;
  onCommit: (sub: string) => void;
  className?: string;          // text style, shared by the label and the input
  compact?: boolean;           // tight headers (calendar columns)
  onEditingChange?: (editing: boolean) => void;
}

// A day's subtitle ("Universal Studios Orlando"), editable in place: click it,
// type, ✓ (Enter) to save or ✕ (Esc) to cancel.
export default function DaySubtitle({ value, onCommit, className, compact, onEditingChange }: DaySubtitleProps) {
  const [draft, setDraft] = useState<string | null>(null);

  function open() { setDraft(value); onEditingChange?.(true); }
  function close() { setDraft(null); onEditingChange?.(false); }
  function commit() {
    if (draft !== null && draft.trim() !== value) onCommit(draft.trim());
    close();
  }

  if (draft === null) {
    return (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); open(); }}
        title="Editar la descripción del día"
        className={cn("group flex min-w-0 max-w-full cursor-text items-center gap-1 text-left", className)}
      >
        <span className={cn("truncate", !value && "italic opacity-60")}>{value || "Agregar descripción"}</span>
        <Pencil className="size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-60" />
      </button>
    );
  }

  const dirty = draft.trim() !== value;
  const btn = cn("flex shrink-0 cursor-pointer items-center justify-center rounded-md", compact ? "size-5" : "size-6");
  return (
    <div className="flex min-w-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
      <input
        autoFocus
        value={draft}
        maxLength={80}
        aria-label="Descripción del día"
        placeholder="Ej. Universal Studios Orlando"
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") close();
        }}
        className={cn(
          "min-w-0 flex-1 rounded-md border border-border bg-card px-1.5 text-foreground outline-none focus:ring-2 focus:ring-ring",
          compact ? "h-5" : "h-7",
          className,
        )}
      />
      <button
        onClick={commit}
        disabled={!dirty}
        aria-label="Guardar"
        className={cn(btn, "bg-primary text-primary-foreground disabled:opacity-40")}
      >
        <Check className="size-3.5" />
      </button>
      <button onClick={close} aria-label="Cancelar" className={cn(btn, "text-muted-foreground hover:bg-secondary")}>
        <X className="size-3.5" />
      </button>
    </div>
  );
}
