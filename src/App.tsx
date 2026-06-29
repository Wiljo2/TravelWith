import { useState, useCallback } from "react";
import { useItinerary } from "./hooks/useItinerary";
import { useDragDrop } from "./hooks/useDragDrop";
import { useBudget } from "./hooks/useBudget";
import { HOUR_START, HOUR_END } from "./constants/time";
import { snapHour } from "./utils/time";
import CalendarGrid from "./components/calendar/CalendarGrid";
import BudgetPanel from "./components/budget/BudgetPanel";
import PriceChip from "./components/budget/PriceChip";
import Toast from "./components/Toast";
import type { ToastAction } from "./types";

export default function App() {
  const { days, selectedId, selectedEvent, setSelectedId, updateEvent, deleteEvent, addEvent, moveEvent } = useItinerary();
  const { extras, cruiseTotal, extrasTotal, grandTotal, pricePerPerson, updateExtra } = useBudget();
  const [toastAction, setToastAction] = useState<ToastAction | null>(null);
  const dismissToast = useCallback(() => setToastAction(null), []);

  const { onDragStart, onDragEnter, onDragMove, onDropInDay, onDragEnd, dragTarget, dragPreview } = useDragDrop(
    (fromDayId, toDayId, ev, droppedHour) => {
      const dur = ev.end - ev.start;
      const newStart = snapHour(droppedHour, dur, HOUR_START, HOUR_END);
      const newEnd   = newStart + dur;

      moveEvent(fromDayId, toDayId, ev, newStart);

      setToastAction({
        title: ev.title,
        newStart,
        newEnd,
        undo: () => {
          moveEvent(toDayId, fromDayId, { ...ev, start: newStart, end: newEnd }, ev.start);
          setToastAction(null);
        },
      });
    }
  );

  return (
    <div className="app-shell">
      <div className="app-header">
        <div>
          <div className="app-eyebrow">Wonder of the Seas · 4 noches + Miami</div>
          <h1 className="app-title">Bahamas &amp; Perfect Day · Nov 28 – Dic 4, 2026</h1>
          <div className="app-subtitle">
            Arrastra cualquier bloque para reorganizar el plan · clic para editar horas
          </div>
        </div>
        <div className="price-chips">
          <PriceChip label="Crucero (2 pax)" value={`$${cruiseTotal.toLocaleString()}`} sub={`$${pricePerPerson}/pp`} accent />
          <PriceChip label="Extras estimados" value={`$${extrasTotal.toLocaleString()}`} sub="editable abajo" />
          <PriceChip label="Total estimado" value={`$${grandTotal.toLocaleString()}`} sub="USD" strong />
        </div>
      </div>

      <div className="app-body">
        <CalendarGrid
          days={days}
          onDragStart={onDragStart}
          onDragEnter={onDragEnter}
          onDragMove={onDragMove}
          onDrop={onDropInDay}
          onDragEnd={onDragEnd}
          onSelect={setSelectedId}
          selectedId={selectedId}
          dragTarget={dragTarget}
          dragPreview={dragPreview}
          onAddEvent={addEvent}
        />
        <BudgetPanel
          selectedEvent={selectedEvent}
          onUpdateEvent={updateEvent}
          onDeleteEvent={deleteEvent}
          extras={extras}
          cruiseTotal={cruiseTotal}
          extrasTotal={extrasTotal}
          grandTotal={grandTotal}
          pricePerPerson={pricePerPerson}
          onUpdateExtra={updateExtra}
        />
      </div>

      <Toast
        action={toastAction}
        onUndo={toastAction?.undo}
        onDismiss={dismissToast}
      />
    </div>
  );
}
