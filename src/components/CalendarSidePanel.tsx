"use client";
import { useState } from "react";
import { SlidersHorizontal, Sparkles } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { cn } from "@/lib/utils";

export type SidePanelView = "budget" | "agent";

interface CalendarSidePanelProps {
  mobile: boolean;
  // Phone only: which panel the bottom sheet shows (null = closed).
  sheetView: SidePanelView | null;
  onOpenSheet: (view: SidePanelView) => void;
  onCloseSheet: () => void;
  budgetTitle: string;
  budgetPanel: React.ReactNode;
  agentPanel: React.ReactNode;
}

// The calendar's companion panel: a fixed column beside the grid on desktop;
// on phones, floating buttons that open it in a bottom sheet.
export default function CalendarSidePanel({
  mobile, sheetView, onOpenSheet, onCloseSheet, budgetTitle, budgetPanel, agentPanel,
}: CalendarSidePanelProps) {
  const [tab, setTab] = useState<SidePanelView>("budget");
  // Keep showing the last panel while the sheet animates closed.
  if (sheetView && sheetView !== tab) setTab(sheetView);

  if (!mobile) {
    return (
      <div className="flex w-[300px] shrink-0 flex-col gap-2">
        <div className="flex overflow-hidden rounded-lg border border-border bg-card">
          {([["budget", "Presupuesto"], ["agent", "✨ Asistente"]] as const).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                "flex-1 cursor-pointer py-1.5 text-xs font-semibold transition-colors",
                tab === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {tab === "agent" ? agentPanel : budgetPanel}
      </div>
    );
  }

  return (
    <>
      <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+76px)] right-4 z-30 flex flex-col items-center gap-2.5">
        <button
          onClick={() => onOpenSheet("budget")}
          aria-label="Panel del viaje"
          className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-border bg-card text-secondary-foreground shadow-[0_4px_14px_rgba(0,0,0,.14)] active:scale-95"
        >
          <SlidersHorizontal className="size-5" />
        </button>
        <button
          onClick={() => onOpenSheet("agent")}
          aria-label="Asistente"
          className="flex h-14 w-14 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_6px_20px_rgba(4,52,44,.28)] active:scale-95"
        >
          <Sparkles className="size-6" />
        </button>
      </div>

      <BottomSheet
        open={sheetView !== null}
        onOpenChange={(open) => { if (!open) onCloseSheet(); }}
        title={tab === "agent" ? "✨ Asistente" : budgetTitle}
        bodyClassName={tab === "agent" ? "px-0 pb-0" : undefined}
      >
        {tab === "agent" ? agentPanel : budgetPanel}
      </BottomSheet>
    </>
  );
}
