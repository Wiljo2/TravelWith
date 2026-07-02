import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useItinerary } from "@/hooks/useItinerary";
import { useDragDrop } from "@/hooks/useDragDrop";
import { useBudget } from "@/hooks/useBudget";
import { useRoom } from "@/hooks/useRoom";
import type { RoomPayload, MockPerson } from "@/hooks/useRoom";
import { HOUR_START, HOUR_END } from "@/constants/time";
import { snapHour } from "@/utils/time";
import { extraGroupUSD } from "@/utils/currency";
import CalendarGrid from "@/components/calendar/CalendarGrid";
import SlotCreateModal from "@/components/calendar/SlotCreateModal";
import BudgetPanel from "@/components/budget/BudgetPanel";
import BudgetView from "@/components/budget/BudgetView";
import TabBar from "@/components/TabBar";
import type { Tab } from "@/components/TabBar";
import AppHeader from "@/components/AppHeader";
import Toast from "@/components/Toast";
import RoomGate from "@/components/RoomGate";
import TasksView from "@/components/tasks/TasksView";
import type { Task, ToastAction, TripSpan } from "@/types";
import { initialDays } from "@/data/initialDays";

export default function App() {
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("calendar");
  const [pendingNew, setPendingNew] = useState<{ dayId: string; hour: number } | null>(null);
  const [slotDraft, setSlotDraft] = useState<{ dayId: string; hour: number; x: number; y: number; task: Task | null } | null>(null);

  const { days, selectedId, selectedEvent, setSelectedId, updateEvent, deleteEvent, addEvent, moveEvent, loadDays, removeDaySpan, updateDaySpan } = useItinerary();
  const { extras, exchangeRate, setExchangeRate, updateExtra, addExtra, removeExtra, loadBudget } = useBudget();
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
  function addTask(partial: Partial<Task> & { title: string }) {
    setTasks((prev) => [...prev, { id: crypto.randomUUID(), done: false, ...partial }]);
  }
  function toggleTask(id: string) {
    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, done: !t.done } : t));
  }
  function updateTask(id: string, patch: Partial<Task>) {
    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, ...patch } : t));
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

  const { connected, members, saveState, save } = useRoom(roomCode, onRemoteUpdate);
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
      <AppHeader
        roomCode={roomCode}
        connected={connected}
        saveState={saveState}
        grandTotal={grandTotal}
        exchangeRate={exchangeRate}
        onReset={() => {
          if (confirm("¿Restablecer el itinerario al default? Se perderán los cambios guardados.")) {
            loadDays(initialDays);
            setTripSpans([]);
          }
        }}
        onLeaveRoom={() => setRoomCode(null)}
      />

      <TabBar active={activeTab} onChange={setActiveTab} pendingTaskCount={pendingTaskCount} />

      {activeTab === "calendar" && (
        <div className="app-body">
          <CalendarGrid
            days={days}
            tripSpans={tripSpans}
            tasks={tasks}
            onDragStart={onDragStart}
            onDragEnter={onDragEnter}
            onDragMove={onDragMove}
            onDrop={onDropInDay}
            onDragEnd={onDragEnd}
            onSelect={handleSelect}
            selectedId={selectedId}
            dragTarget={dragTarget}
            dragPreview={dragPreview}
            onAddEvent={(dayId, h, x, y) => {
              setPendingNew(null);
              setSelectedId(null);
              setSlotDraft({ dayId, hour: h, x, y, task: null });
            }}
            onToggleTask={toggleTask}
            onEditTask={(task, x, y) => setSlotDraft({ dayId: task.dayId!, hour: task.start ?? 8, x, y, task })}
            pendingNew={pendingNew ?? (slotDraft && !slotDraft.task ? { dayId: slotDraft.dayId, hour: slotDraft.hour } : null)}
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
            onLinkExtra={linkExtra}
            onAddExtra={addExtra}
            onRemoveExtra={removeExtra}
            tripSpans={tripSpans}
            onAddTripSpan={addTripSpan}
            onRemoveTripSpan={removeTripSpan}
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
          days={days}
          tasks={tasks}
          onAdd={(title) => addTask({ title })}
          onToggle={toggleTask}
          onUpdateTask={updateTask}
          onDelete={deleteTask}
        />
      )}

      <Toast action={toastAction} onUndo={toastAction?.undo} onDismiss={dismissToast} />

      {slotDraft && (
        <SlotCreateModal
          x={slotDraft.x}
          y={slotDraft.y}
          dayLabel={days.find((d) => d.id === slotDraft.dayId)?.label ?? ""}
          hour={slotDraft.hour}
          existing={slotDraft.task}
          onSaveActivity={({ title, note, cat, start, end }) => {
            addEvent(slotDraft.dayId, title, start, end, note, cat);
            setSlotDraft(null);
          }}
          onSaveTask={(patch) => {
            if (slotDraft.task) updateTask(slotDraft.task.id, patch);
            else addTask({ ...patch, dayId: slotDraft.dayId, title: patch.title ?? "" });
            setSlotDraft(null);
          }}
          onDeleteTask={slotDraft.task ? () => { deleteTask(slotDraft.task!.id); setSlotDraft(null); } : undefined}
          onClose={() => setSlotDraft(null)}
        />
      )}
    </div>
  );
}
