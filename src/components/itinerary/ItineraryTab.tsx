"use client";
import type { ReactNode } from "react";
import type { useItinerary } from "@/hooks/useItinerary";
import type { useTasks } from "@/hooks/useTasks";
import type { useDragDrop } from "@/hooks/useDragDrop";
import CalendarGrid from "@/components/calendar/CalendarGrid";
import ItineraryView from "@/components/itinerary/ItineraryView";
import type { ItinerarySheet } from "@/components/itinerary/ItineraryView";
import ItineraryAgenda from "@/components/itinerary/ItineraryAgenda";
import SpansManager from "@/components/itinerary/SpansManager";
import type { Task } from "@/types";

// A new activity or task at a free slot (task null), or an existing scheduled task, opened at (x, y).
export interface SlotDraft {
  dayId: string;
  hour: number;
  x: number;
  y: number;
  task: Task | null;
}

interface ItineraryTabProps {
  mobile: boolean;
  itinerary: ReturnType<typeof useItinerary>;
  taskState: ReturnType<typeof useTasks>;
  drag: ReturnType<typeof useDragDrop>;
  todayIdx: number | undefined;
  tipsByEvent: Record<string, number>;
  // ActivityDetail for the selected activity.
  detail: ReactNode;
  agent: ReactNode;
  focusAgent: boolean;
  sheet: ItinerarySheet | null;
  onSheet: (sheet: ItinerarySheet | null) => void;
  onSelect: (id: string | null) => void;
  slotDraft: SlotDraft | null;
  onSlotDraft: (draft: SlotDraft) => void;
}

// The Itinerario tab: agenda or hour grid, with the detail, assistant and calendar backgrounds.
export default function ItineraryTab({
  mobile, itinerary, taskState, drag, todayIdx, tipsByEvent, detail, agent, focusAgent, sheet, onSheet, onSelect, slotDraft, onSlotDraft,
}: ItineraryTabProps) {
  const { days, tripSpans, selectedId, setSelectedId, swapDays, setDaySub, removeDaySpan, updateDaySpan, removeTripSpan, updateTripSpan } = itinerary;
  const { tasks, toggleTask, swapTaskDays } = taskState;

  // Swap the whole contents of two days (events + spans) and their scheduled tasks.
  function swapDaysWithTasks(aId: string, bId: string) {
    if (aId === bId) return;
    swapDays(aId, bId);
    swapTaskDays(aId, bId);
  }

  function openSlot(dayId: string, hour: number, x: number, y: number) {
    setSelectedId(null);
    onSlotDraft({ dayId, hour, x, y, task: null });
  }

  const editTask = (task: Task, x: number, y: number) => onSlotDraft({ dayId: task.dayId!, hour: task.start ?? 8, x, y, task });

  return (
    <ItineraryView
      mobile={mobile}
      selectedId={selectedId}
      detail={detail || null}
      agent={agent}
      focusAgent={focusAgent}
      sheet={sheet}
      onOpenSheet={onSheet}
      onCloseSheet={() => { onSheet(null); setSelectedId(null); }}
      settings={
        <SpansManager
          days={days}
          tripSpans={tripSpans}
          onRemoveTripSpan={removeTripSpan}
          onUpdateTripSpan={updateTripSpan}
          onRemoveDaySpan={removeDaySpan}
          onUpdateDaySpan={updateDaySpan}
        />
      }
      agenda={
        <ItineraryAgenda
          days={days}
          tripSpans={tripSpans}
          tasks={tasks}
          selectedId={selectedId}
          todayIdx={todayIdx}
          onSelect={onSelect}
          onAdd={openSlot}
          onEditTask={editTask}
          onToggleTask={toggleTask}
          onSetDaySub={setDaySub}
          tipsByEvent={tipsByEvent}
        />
      }
      grid={
        <CalendarGrid
          days={days}
          tripSpans={tripSpans}
          tasks={tasks}
          onDragStart={drag.onDragStart}
          onTouchDragStart={drag.beginDrag}
          onTouchDragCancel={drag.cancelDrag}
          onDragEnter={drag.onDragEnter}
          onDragMove={drag.onDragMove}
          onDrop={drag.onDropInDay}
          onDragEnd={drag.onDragEnd}
          onSelect={onSelect}
          selectedId={selectedId}
          dragTarget={drag.dragTarget}
          dragPreview={drag.dragPreview}
          onAddEvent={openSlot}
          onToggleTask={toggleTask}
          onEditTask={editTask}
          onSwapDays={swapDaysWithTasks}
          onSetDaySub={setDaySub}
          tipsByEvent={tipsByEvent}
          pendingNew={slotDraft && !slotDraft.task ? { dayId: slotDraft.dayId, hour: slotDraft.hour } : null}
          initialDayIdx={todayIdx}
        />
      }
    />
  );
}
