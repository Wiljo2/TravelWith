"use client";
import { ChevronRight } from "lucide-react";

export const PANEL = "rounded-2xl bg-card p-4 shadow-[0_1px_2px_rgba(0,0,0,.04)] ring-1 ring-border/70 md:p-5";

export function SectionTitle({ title, count, action, onAction }: {
  title: string; count?: number; action?: string; onAction?: () => void;
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="flex items-center gap-2 text-[15px] font-semibold">
        {title}
        {!!count && (
          <span className="rounded-full bg-muted px-2 py-px text-xs font-medium text-muted-foreground">{count}</span>
        )}
      </h2>
      {action && onAction && (
        <button
          onClick={onAction}
          className="flex cursor-pointer items-center gap-0.5 text-[13px] font-medium text-emerald-700 hover:underline"
        >
          {action}
          <ChevronRight className="size-4" />
        </button>
      )}
    </div>
  );
}

export function Progress({ done, total }: { done: number; total: number }) {
  if (total === 0) return null;
  return (
    <div className="mb-3">
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(done / total) * 100}%` }} />
      </div>
      <div className="mt-1.5 text-xs text-muted-foreground">{done} de {total} listos</div>
    </div>
  );
}
