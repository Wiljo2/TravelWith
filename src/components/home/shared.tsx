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
