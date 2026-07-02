"use client";
import EventEditor from "@/components/editor/EventEditor";
import NewEventForm from "@/components/budget/NewEventForm";
import RangesSection from "@/components/budget/RangesSection";
import LinkedExtrasSection from "@/components/budget/LinkedExtrasSection";
import TaskPreviewCard from "@/components/budget/TaskPreviewCard";
import CalendarSpansCard from "@/components/budget/CalendarSpansCard";
import PerPersonCard from "@/components/budget/PerPersonCard";
import type { CalendarEvent, Extra, Day, DaySpan, TripSpan, Task } from "@/types";

interface BudgetPanelProps {
  selectedEvent: { ev: CalendarEvent; dayId: string } | null;
  onUpdateEvent: (patch: Partial<CalendarEvent>) => void;
  onDeleteEvent: () => void;
  days: Day[];
  extras: Extra[];
  grandTotal: number;
  exchangeRate: number;
  people: number;
  onLinkExtra: (extraId: string, eventId: string | undefined) => void;
  onRemoveExtra: (id: string) => void;
  onAddExtra: (partial?: Partial<Extra>) => void;
  tripSpans: TripSpan[];
  onAddTripSpan: (span: TripSpan) => void;
  onRemoveTripSpan: (id: string) => void;
  onRemoveDaySpan: (dayId: string, spanId: string) => void;
  onUpdateDaySpan: (dayId: string, spanId: string, patch: Partial<DaySpan>) => void;
  onUpdateTripSpan: (id: string, patch: Partial<TripSpan>) => void;
  tasks: Task[];
  pendingNew: { dayId: string; hour: number } | null;
  onCommitNew: (title: string, start: number, end: number, note: string) => void;
  onCancelNew: () => void;
}

export default function BudgetPanel({
  selectedEvent, onUpdateEvent, onDeleteEvent,
  days, extras, grandTotal, exchangeRate, people,
  onLinkExtra, onAddExtra, onRemoveExtra,
  tripSpans, onAddTripSpan, onRemoveTripSpan, onUpdateTripSpan,
  onRemoveDaySpan, onUpdateDaySpan,
  tasks, pendingNew, onCommitNew, onCancelNew,
}: BudgetPanelProps) {
  const pendingDay = pendingNew ? days.find((d) => d.id === pendingNew.dayId) : null;

  return (
    <div style={{ width: 300, flexShrink: 0, display: "flex", flexDirection: "column", gap: 10 }}>

      <div style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 10, padding: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
          {selectedEvent ? "Editar actividad" : pendingNew ? "Nueva actividad" : "Selecciona un bloque"}
        </div>

        {selectedEvent ? (
          <>
            <EventEditor ev={selectedEvent.ev} onChange={onUpdateEvent} onDelete={onDeleteEvent} />
            <RangesSection
              selectedEvent={selectedEvent}
              days={days}
              tripSpans={tripSpans}
              onAddTripSpan={onAddTripSpan}
              onRemoveTripSpan={onRemoveTripSpan}
            />
            <LinkedExtrasSection
              selectedEvent={selectedEvent}
              extras={extras}
              onLinkExtra={onLinkExtra}
              onAddExtra={onAddExtra}
              onRemoveExtra={onRemoveExtra}
            />
          </>
        ) : pendingNew ? (
          <NewEventForm
            key={`${pendingNew.dayId}-${pendingNew.hour}`}
            defaultHour={pendingNew.hour}
            dayLabel={pendingDay?.label ?? ""}
            onSave={onCommitNew}
            onCancel={onCancelNew}
          />
        ) : (
          <div style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.5 }}>
            Haz clic en cualquier espacio vacío del calendario para agregar una actividad.
          </div>
        )}
      </div>

      <TaskPreviewCard tasks={tasks} />

      <CalendarSpansCard
        days={days}
        tripSpans={tripSpans}
        onRemoveTripSpan={onRemoveTripSpan}
        onUpdateTripSpan={onUpdateTripSpan}
        onRemoveDaySpan={onRemoveDaySpan}
        onUpdateDaySpan={onUpdateDaySpan}
      />

      <PerPersonCard extras={extras} grandTotal={grandTotal} exchangeRate={exchangeRate} people={people} />
    </div>
  );
}
