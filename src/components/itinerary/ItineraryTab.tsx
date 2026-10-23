"use client";
import { useState } from "react";
import type { ReactNode } from "react";
import type { useItinerary } from "@/hooks/useItinerary";
import type { useTasks } from "@/hooks/useTasks";
import type { useDragDrop } from "@/hooks/useDragDrop";
import CalendarGrid from "@/components/calendar/CalendarGrid";
import ItineraryView from "@/components/itinerary/ItineraryView";
import type { ItinerarySheet } from "@/components/itinerary/ItineraryView";
import ItineraryAgenda from "@/components/itinerary/ItineraryAgenda";
import MonthView from "@/components/itinerary/MonthView";
import SpansManager from "@/components/itinerary/SpansManager";
import DatesPending from "@/components/itinerary/DatesPending";
import { useItineraryMode, type ItineraryMode } from "@/hooks/useItineraryMode";
import { hasDates } from "@/utils/tripDays";
import { spansSeveralWeeks } from "@/utils/tripWeeks";
import { openVote } from "@/utils/votes";
import type { Task, TaskDecides, TripInfo } from "@/types";

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
  trip: TripInfo | null;
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
  // A trip without dates has no days: these lead to its dates vote (on Inicio).
  onStartVote: (kind: TaskDecides) => void;
  onOpenVotes: () => void;
}

// The Itinerario tab: agenda, hour grid or month, with the detail, assistant and calendar
// backgrounds; "Primero decidamos las fechas" while the trip has no dates or days.
export default function ItineraryTab({
  mobile, trip, itinerary, taskState, drag, todayIdx, tipsByEvent, detail, agent, focusAgent, sheet, onSheet, onSelect, slotDraft, onSlotDraft,
  onStartVote, onOpenVotes,
}: ItineraryTabProps) {
  const { days, tripSpans, selectedId, setSelectedId, swapDays, setDaySub, removeDaySpan, updateDaySpan, removeTripSpan, updateTripSpan } = itinerary;
  const { tasks, toggleTask, swapTaskDays } = taskState;
  // The month view is offered only for dated trips that don't fit in one Mon–Sun week.
  const monthTrip = hasDates(trip) && days.length > 0 && spansSeveralWeeks(trip.startDate, trip.endDate) ? trip : null;
  const [mode, setMode] = useItineraryMode(!!monthTrip);
  // A day opened from the month view: the agenda scrolls to it instead of today.
  const [focusDayId, setFocusDayId] = useState<string | null>(null);

  function changeMode(next: ItineraryMode) {
    if (next === mode) return;
    setFocusDayId(null);
    setMode(next);
  }

  function openDay(dayId: string) {
    setFocusDayId(dayId);
    setMode("agenda");
  }

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

  const datesPending = !!trip && !hasDates(trip) && days.length === 0 && (
    <DatesPending
      vote={openVote(tasks, "dates")}
      onOpenVote={onOpenVotes}
      onStartVote={() => { onStartVote("dates"); onOpenVotes(); }}
    />
  );

  return (
    <ItineraryView
      mobile={mobile}
      selectedId={selectedId}
      mode={mode}
      onModeChange={changeMode}
      detail={detail || null}
      agent={agent}
      focusAgent={focusAgent}
      sheet={sheet}
      onOpenSheet={onSheet}
      onCloseSheet={() => { onSheet(null); setSelectedId(null); }}
      pending={datesPending || undefined}
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
          compact={!mobile}
          focusDayId={focusDayId}
          drag={drag}
        />
      }
      month={monthTrip ? (
        <MonthView
          startDate={monthTrip.startDate}
          endDate={monthTrip.endDate}
          days={days}
          tripSpans={tripSpans}
          todayIdx={todayIdx}
          onOpenDay={openDay}
        />
      ) : undefined}
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
