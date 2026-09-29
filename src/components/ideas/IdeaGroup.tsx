"use client";
import { Children, useState } from "react";
import { ChevronDown } from "lucide-react";
import { PANEL } from "@/components/home/shared";
import { cn } from "@/lib/utils";

const PREVIEW = 5;

interface IdeaGroupProps {
  title: string;
  subtitle?: string;           // the area of a venue ("Orlando")
  count: number;
  muted?: boolean;
  children: React.ReactNode;   // IdeaRow items
}

// A place's ideas as a compact list: collapsible, showing the first few rows.
export default function IdeaGroup({ title, subtitle, count, muted, children }: IdeaGroupProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const rows = Children.toArray(children);
  const shown = showAll ? rows : rows.slice(0, PREVIEW);

  return (
    <section className={cn(PANEL, "py-2 md:py-2")}>
      <button
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
        className="flex w-full cursor-pointer items-center gap-2 py-1.5 text-left"
      >
        <span className={cn("min-w-0 max-w-[75%] shrink-0 truncate text-[15px] font-semibold", muted && "text-secondary-foreground")}>📍 {title}</span>
        {subtitle && <span className="truncate text-xs text-muted-foreground">{subtitle}</span>}
        <span className="rounded-full bg-muted px-2 py-px text-xs font-medium text-muted-foreground">{count}</span>
        <ChevronDown className={cn("ml-auto size-4 text-muted-foreground transition-transform", collapsed && "-rotate-90")} />
      </button>
      {!collapsed && (
        <>
          <ul className="divide-y divide-border border-t border-border">{shown}</ul>
          {rows.length > PREVIEW && (
            <button
              onClick={() => setShowAll((s) => !s)}
              className="w-full cursor-pointer border-t border-border py-2 text-center text-[13px] font-medium text-emerald-700 hover:underline"
            >
              {showAll ? "Ver menos" : `Ver ${rows.length - PREVIEW} más`}
            </button>
          )}
        </>
      )}
    </section>
  );
}
