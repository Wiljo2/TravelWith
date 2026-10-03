"use client";
import { useState } from "react";
import { CalendarClock, Layers, LayoutList, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Disclosure } from "@/components/ui/disclosure";
import { PANEL } from "@/components/home/shared";
import { cn } from "@/lib/utils";

export type ItinerarySheet = "detail" | "agent" | "settings";
type Mode = "agenda" | "grid";

const MODE_KEY = "tw.itineraryMode";

interface ItineraryViewProps {
  mobile: boolean;
  selectedId: string | null;
  agenda: React.ReactNode;
  grid: React.ReactNode;
  // ActivityDetail for the selected activity, or null when nothing is selected.
  detail: React.ReactNode | null;
  settings: React.ReactNode;
  agent: React.ReactNode;
  // Phone only: which bottom sheet is open.
  sheet: ItinerarySheet | null;
  onOpenSheet: (sheet: ItinerarySheet) => void;
  onCloseSheet: () => void;
}

function readMode(): Mode {
  try {
    return localStorage.getItem(MODE_KEY) === "grid" ? "grid" : "agenda";
  } catch {
    return "agenda";
  }
}

const SHEET_TITLE: Record<ItinerarySheet, string> = {
  detail: "Actividad",
  agent: "✨ Asistente",
  settings: "Fondos del calendario",
};

// Itinerary section: agenda list by default, hour grid on demand. The detail /
// assistant live in a side panel on desktop and in bottom sheets on phones.
export default function ItineraryView({
  mobile, selectedId, agenda, grid, detail, settings, agent, sheet, onOpenSheet, onCloseSheet,
}: ItineraryViewProps) {
  const [mode, setMode] = useState<Mode>(readMode);
  const [panel, setPanel] = useState<"detail" | "agent">("detail");
  const [prevSelected, setPrevSelected] = useState(selectedId);
  if (selectedId !== prevSelected) {
    setPrevSelected(selectedId);
    if (selectedId) setPanel("detail");
  }
  // Keep the last sheet's content while it animates closed.
  const [shownSheet, setShownSheet] = useState<ItinerarySheet>("detail");
  if (sheet && sheet !== shownSheet) setShownSheet(sheet);

  function changeMode(next: Mode) {
    setMode(next);
    try { localStorage.setItem(MODE_KEY, next); } catch { /* storage unavailable */ }
  }

  const toolbar = (
    <div className="mb-4 flex items-center justify-between gap-3">
      <div className="inline-flex gap-1 rounded-full bg-muted p-1">
        <ModeButton icon={LayoutList} label="Agenda" active={mode === "agenda"} onClick={() => changeMode("agenda")} />
        <ModeButton icon={CalendarClock} label="Horas" active={mode === "grid"} onClick={() => changeMode("grid")} />
      </div>
      {mobile && (
        <button
          onClick={() => onOpenSheet("settings")}
          className="flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium text-secondary-foreground hover:bg-secondary"
        >
          <Layers className="size-4" />
          Fondos
        </button>
      )}
    </div>
  );

  const main = mode === "agenda" ? agenda : grid;

  if (mobile) {
    return (
      <>
        {toolbar}
        {main}
        {agent && (
          <button
            onClick={() => onOpenSheet("agent")}
            aria-label="Asistente"
            className="fixed bottom-[calc(env(safe-area-inset-bottom)+76px)] right-4 z-30 flex h-14 w-14 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_6px_20px_rgba(4,52,44,.28)] active:scale-95"
          >
            <Sparkles className="size-6" />
          </button>
        )}
        <BottomSheet
          open={sheet !== null}
          onOpenChange={(open) => { if (!open) onCloseSheet(); }}
          title={SHEET_TITLE[shownSheet]}
          bodyClassName={shownSheet === "agent" ? "px-0 pb-0" : undefined}
        >
          {shownSheet === "agent" ? agent : shownSheet === "settings" ? settings : detail}
        </BottomSheet>
      </>
    );
  }

  return (
    <>
      {toolbar}
      <div className="flex items-start gap-5">
        <div className="min-w-0 flex-1">{main}</div>
        <aside className="sticky top-4 flex w-[340px] shrink-0 flex-col gap-3">
          {agent && (
            <div className="inline-flex gap-1 self-start rounded-full bg-muted p-1">
              <ModeButton label="Detalle" active={panel === "detail"} onClick={() => setPanel("detail")} />
              <ModeButton icon={Sparkles} label="Asistente" active={panel === "agent"} onClick={() => setPanel("agent")} />
            </div>
          )}
          {panel === "agent" && agent ? agent : (
            <div className={cn(PANEL, "max-h-[calc(100dvh-7rem)] overflow-y-auto")}>
              {detail ?? (
                <>
                  <p className="text-sm text-secondary-foreground">
                    Selecciona una actividad para ver y editar sus detalles.
                  </p>
                  <Disclosure title="Fondos del calendario" className="mt-4 border-b">
                    {settings}
                  </Disclosure>
                </>
              )}
            </div>
          )}
        </aside>
      </div>
    </>
  );
}

function ModeButton({ icon: Icon, label, active, onClick }: { icon?: LucideIcon; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex cursor-pointer items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors",
        active ? "bg-card text-foreground shadow-[0_1px_3px_rgba(0,0,0,.08)]" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {Icon && <Icon className="size-4" />}
      {label}
    </button>
  );
}
