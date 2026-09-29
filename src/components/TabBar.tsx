"use client";
import { CalendarDays, ListChecks, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export type Tab = "calendar" | "budget" | "tasks";

interface TabBarProps {
  active: Tab;
  onChange: (tab: Tab) => void;
  pendingTaskCount?: number;
}

const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: "calendar", label: "Actividades", icon: CalendarDays },
  { id: "budget",   label: "Presupuesto", icon: Wallet },
  { id: "tasks",    label: "Tareas",      icon: ListChecks },
];

// Top tabs on desktop; fixed iOS-style bar at the bottom on phones.
export default function TabBar({ active, onChange, pendingTaskCount }: TabBarProps) {
  return (
    <nav
      className={cn(
        "fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md",
        "md:static md:z-auto md:border-b md:border-t-0 md:bg-card md:px-5 md:pb-0 md:backdrop-blur-none",
      )}
    >
      {TABS.map((t) => {
        const isActive = active === t.id;
        const showBadge = t.id === "tasks" && pendingTaskCount != null && pendingTaskCount > 0;
        const Icon = t.icon;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={cn(
              "relative flex flex-1 cursor-pointer flex-col items-center gap-0.5 pb-1.5 pt-2 text-[10.5px] font-medium transition-colors",
              "md:flex-none md:flex-row md:gap-1.5 md:border-b-2 md:px-5 md:py-2.5 md:text-sm md:font-normal",
              isActive
                ? "text-emerald-700 md:border-primary md:font-semibold"
                : "text-muted-foreground hover:text-foreground md:border-transparent",
            )}
          >
            <Icon className="size-[22px] md:hidden" strokeWidth={isActive ? 2.25 : 1.75} />
            {t.label}
            {showBadge && (
              <Badge
                className={cn(
                  "h-[18px] min-w-[18px] rounded-full px-1.5 text-[11px]",
                  "absolute left-1/2 top-1 ml-2 md:static md:ml-0",
                  !isActive && "md:bg-border md:text-muted-foreground",
                )}
              >
                {pendingTaskCount}
              </Badge>
            )}
          </button>
        );
      })}
    </nav>
  );
}
