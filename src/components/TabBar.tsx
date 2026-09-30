"use client";
import { CalendarDays, House, Lightbulb, ListChecks, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type Tab = "home" | "calendar" | "ideas" | "budget" | "tasks";

interface TabBarProps {
  active: Tab;
  onChange: (tab: Tab) => void;
  pendingTaskCount?: number;
}

const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: "home",     label: "Inicio",     icon: House },
  { id: "calendar", label: "Itinerario", icon: CalendarDays },
  { id: "ideas",    label: "Ideas",      icon: Lightbulb },
  { id: "budget",   label: "Gastos",     icon: Wallet },
  { id: "tasks",    label: "Pendientes", icon: ListChecks },
];

// Pill tabs under the header on desktop; fixed iOS-style bar at the bottom on phones.
export default function TabBar({ active, onChange, pendingTaskCount }: TabBarProps) {
  return (
    <nav
      className={cn(
        "fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md",
        "md:static md:z-auto md:mb-5 md:inline-flex md:gap-1 md:rounded-full md:border-0 md:bg-muted md:p-1 md:pb-1 md:backdrop-blur-none",
      )}
    >
      {TABS.map((t) => {
        const isActive = active === t.id;
        const badge = t.id === "tasks" && pendingTaskCount ? pendingTaskCount : null;
        const Icon = t.icon;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "relative flex flex-1 cursor-pointer flex-col items-center gap-0.5 pb-1.5 pt-2 text-[10.5px] font-medium transition-colors",
              "md:flex-none md:flex-row md:gap-2 md:rounded-full md:px-4 md:py-1.5 md:text-sm",
              isActive
                ? "text-emerald-700 md:bg-card md:text-foreground md:shadow-[0_1px_3px_rgba(0,0,0,.08)]"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-[22px] md:size-4" strokeWidth={isActive ? 2.25 : 1.75} />
            {t.label}
            {badge && (
              <span
                className={cn(
                  "flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground",
                  "absolute left-1/2 top-1 ml-2 md:static md:ml-0",
                )}
              >
                {badge}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
