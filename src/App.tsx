import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useItinerary } from "./hooks/useItinerary";
import { useDragDrop } from "./hooks/useDragDrop";
import { useBudget } from "./hooks/useBudget";
import { useRoom } from "./hooks/useRoom";
import type { RoomPayload, MockPerson } from "./hooks/useRoom";
import { HOUR_START, HOUR_END } from "./constants/time";
import { snapHour } from "./utils/time";
import { usdToCop, fmtUSD, fmtCOP, extraGroupUSD } from "./utils/currency";
import CalendarGrid from "./components/calendar/CalendarGrid";
import BudgetPanel from "./components/budget/BudgetPanel";
import BudgetView from "./components/budget/BudgetView";
import TabBar from "./components/TabBar";
import type { Tab } from "./components/TabBar";
import AuthButton from "./components/auth/AuthButton";
import PriceChip from "./components/budget/PriceChip";
import Toast from "./components/Toast";
import RoomGate from "./components/RoomGate";
import TasksView from "./components/tasks/TasksView";
import type { Task, ToastAction, TripSpan } from "./types";
import { initialDays } from "./data/initialDays";

export default function App() {
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("calendar");
  const [pendingNew, setPendingNew] = useState<{ dayId: string; hour: number } | null>(null);

  const { days, selectedId, selectedEvent, setSelectedId, updateEvent, deleteEvent, addEvent, moveEvent, loadDays, addDaySpan, removeDaySpan, updateDaySpan } = useItinerary();
  const { extras, exchangeRate, setExchangeRate, updateExtraUSD, updateExtraCOP, updateExtra, addExtra, removeExtra, loadBudget } = useBudget();
  const [mockPeople, setMockPeople] = useState<MockPerson[]>([]);
  const [tripSpans, setTripSpans] = useState<TripSpan[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  function addTripSpan(span: TripSpan) { setTripSpans((p) => [...p, span]); }
  function removeTripSpan(id: string)  { setTripSpans((p) => p.filter((s) => s.id !== id)); }
  function updateTripSpan(id: string, patch: Partial<TripSpan>) { setTripSpans((p) => p.map((s) => s.id === id ? { ...s, ...patch } : s)); }

  function addMockPerson(name: string) {
    setMockPeople((prev) => [...prev, { id: crypto.randomUUID(), name }]);
  }
  function removeMockPerson(id: string) {
    setMockPeople((prev) => prev.filter((p) => p.id !== id));
  }

  // Task helpers
  function addTask(title: string) {
    setTasks((prev) => [...prev, { id: crypto.randomUUID(), title, done: false }]);
  }
  function toggleTask(id: string) {
    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, done: !t.done } : t));
  }
  function updateTaskTitle(id: string, title: string) {
    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, title } : t));
  }
  function updateTaskNote(id: string, note: string) {
    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, note } : t));
  }
  function deleteTask(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  const [toastAction, setToastAction] = useState<ToastAction | null>(null);
  const dismissToast = useCallback(() => setToastAction(null), []);

  const onRemoteUpdate = useCallback((payload: RoomPayload) => {
    loadDays(payload.days);
    loadBudget(payload.extras, payload.exchangeRate);
    if (Array.isArray(payload.mockPeople)) setMockPeople(payload.mockPeople);
    if (Array.isArray(payload.tripSpans))  setTripSpans(payload.tripSpans);
    if (Array.isArray(payload.tasks))      setTasks(payload.tasks);
  }, [loadDays, loadBudget]);

  const { connected, members, save } = useRoom(roomCode, onRemoteUpdate);
  const people = Math.max(1, members.length + mockPeople.length);
  // grandTotal depends on people: "perPerson" expenses scale up with the traveler count.
  const grandTotal = useMemo(
    () => extras.reduce((s, e) => s + extraGroupUSD(e, people, exchangeRate), 0),
    [extras, people, exchangeRate],
  );
  const pendingTaskCount = tasks.filter((t) => !t.done).length;

  const linkExtra = useCallback((extraId: string, eventId: string | undefined) => {
    updateExtra(extraId, { linkedEventId: eventId });
  }, [updateExtra]);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!roomCode || roomCode === "LOCAL") return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      save({ days, extras, exchangeRate, mockPeople, tripSpans, tasks });
    }, 600);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, extras, exchangeRate, mockPeople, tripSpans, tasks, roomCode]);

  function handleSelect(id: string | null) {
    setSelectedId(id);
    if (id !== null) setPendingNew(null);
  }

  function commitNewEvent(title: string, start: number, end: number, note: string) {
    if (!pendingNew) return;
    addEvent(pendingNew.dayId, title, start, end, note);
    setPendingNew(null);
  }

  const { onDragStart, onDragEnter, onDragMove, onDropInDay, onDragEnd, dragTarget, dragPreview } = useDragDrop(
    (fromDayId, toDayId, ev, droppedHour) => {
      const dur = ev.end - ev.start;
      const newStart = snapHour(droppedHour, dur, HOUR_START, HOUR_END);
      const newEnd = newStart + dur;
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

  if (!roomCode) {
    return <RoomGate onEnter={setRoomCode} />;
  }

  return (
    <div className="app-shell">
      <div className="app-header">
        <div>
          <div className="app-eyebrow">Wonder of the Seas · Orlando · Miami · Bahamas · CocoCay</div>
          <h1 className="app-title">Bahamas &amp; Perfect Day · Nov 26 – Dic 4, 2026</h1>
          <div className="app-subtitle">
            Arrastra cualquier bloque para reorganizar el plan · clic para editar horas
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {roomCode !== "LOCAL" && (
            <div style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "var(--surface-2)", border: "1px solid var(--border)",
              borderRadius: 8, padding: "6px 12px", fontSize: 12,
            }}>
              <span style={{
                width: 7, height: 7, borderRadius: "50%",
                background: connected ? "#6EE7B7" : "#6b7280", flexShrink: 0,
              }} />
              <span style={{ color: "var(--text-muted)" }}>Sala</span>
              <span style={{ fontFamily: "monospace", fontWeight: 700, letterSpacing: ".05em" }}>{roomCode}</span>
              <button
                title="Restablecer itinerario al default"
                onClick={() => {
                  if (confirm("¿Restablecer el itinerario al default? Se perderán los cambios guardados.")) {
                    loadDays(initialDays);
                    setTripSpans([]);
                  }
                }}
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 12, padding: "0 0 0 4px" }}
              >↺</button>
              <button
                onClick={() => setRoomCode(null)}
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 13, padding: "0 0 0 4px" }}
              >×</button>
            </div>
          )}
          <div className="price-chips">
            <PriceChip label="Total estimado" value={fmtUSD(grandTotal)} sub={fmtCOP(usdToCop(grandTotal, exchangeRate))} strong />
          </div>
          <AuthButton />
        </div>
      </div>

      <TabBar active={activeTab} onChange={setActiveTab} pendingTaskCount={pendingTaskCount} />

      {activeTab === "calendar" && (
        <div className="app-body">
          <CalendarGrid
            days={days}
            tripSpans={tripSpans}
            onDragStart={onDragStart}
            onDragEnter={onDragEnter}
            onDragMove={onDragMove}
            onDrop={onDropInDay}
            onDragEnd={onDragEnd}
            onSelect={handleSelect}
            selectedId={selectedId}
            dragTarget={dragTarget}
            dragPreview={dragPreview}
            onAddEvent={(dayId, h) => {
              if (pendingNew !== null) {
                setPendingNew(null);
              } else {
                setSelectedId(null);
                setPendingNew({ dayId, hour: h });
              }
            }}
            pendingNew={pendingNew}
          />
          <BudgetPanel
            selectedEvent={selectedEvent}
            onUpdateEvent={updateEvent}
            onDeleteEvent={deleteEvent}
            days={days}
            extras={extras}
            grandTotal={grandTotal}
            exchangeRate={exchangeRate}
            people={people}
            onSetExchangeRate={setExchangeRate}
            onUpdateExtraUSD={updateExtraUSD}
            onUpdateExtraCOP={updateExtraCOP}
            onUpdateExtraLabel={(id, label) => updateExtra(id, { label })}
            onLinkExtra={linkExtra}
            onAddExtra={addExtra}
            onRemoveExtra={removeExtra}
            tripSpans={tripSpans}
            onAddTripSpan={addTripSpan}
            onRemoveTripSpan={removeTripSpan}
            onAddDaySpan={addDaySpan}
            onRemoveDaySpan={removeDaySpan}
            onUpdateDaySpan={updateDaySpan}
            onUpdateTripSpan={updateTripSpan}
            tasks={tasks}
            pendingNew={pendingNew}
            onCommitNew={commitNewEvent}
            onCancelNew={() => setPendingNew(null)}
          />
        </div>
      )}

      {activeTab === "budget" && (
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          <BudgetView
            extras={extras}
            grandTotal={grandTotal}
            exchangeRate={exchangeRate}
            members={members}
            mockPeople={mockPeople}
            days={days}
            onSetExchangeRate={setExchangeRate}
            onUpdateExtra={updateExtra}
            onLinkExtra={linkExtra}
            onAddExtra={addExtra}
            onRemoveExtra={removeExtra}
            onAddMockPerson={addMockPerson}
            onRemoveMockPerson={removeMockPerson}
          />
        </div>
      )}

      {activeTab === "tasks" && (
        <TasksView
          tasks={tasks}
          onAdd={addTask}
          onToggle={toggleTask}
          onUpdateTitle={updateTaskTitle}
          onUpdateNote={updateTaskNote}
          onDelete={deleteTask}
        />
      )}

      <Toast action={toastAction} onUndo={toastAction?.undo} onDismiss={dismissToast} />
    </div>
  );
}
