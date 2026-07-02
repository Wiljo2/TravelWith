"use client";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export type Tab = "calendar" | "budget" | "tasks";

interface TabBarProps {
  active: Tab;
  onChange: (tab: Tab) => void;
  pendingTaskCount?: number;
}

const TABS: { id: Tab; label: string }[] = [
  { id: "calendar", label: "Actividades" },
  { id: "budget",   label: "Presupuesto" },
  { id: "tasks",    label: "Tareas" },
];

export default function TabBar({ active, onChange, pendingTaskCount }: TabBarProps) {
  return (
    <div className="flex border-b border-border bg-card px-5">
      {TABS.map((t) => {
        const isActive = active === t.id;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={cn(
              "flex items-center gap-1.5 border-b-2 px-5 py-2.5 text-sm transition-colors",
              isActive
                ? "border-primary font-semibold text-emerald-700"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
            {t.id === "tasks" && pendingTaskCount != null && pendingTaskCount > 0 && (
              <Badge className={cn("h-[18px] min-w-[18px] rounded-full px-1.5 text-[11px]", !isActive && "bg-border text-muted-foreground")}>
                {pendingTaskCount}
              </Badge>
            )}
          </button>
        );
      })}
    </div>
  );
}
