import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useItinerary } from "@/hooks/useItinerary";
import { useDragDrop } from "@/hooks/useDragDrop";
import { useBudget } from "@/hooks/useBudget";
import { useRoom } from "@/hooks/useRoom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRooms } from "@/hooks/useUserRooms";
import type { RoomPayload, MockPerson } from "@/hooks/useRoom";
import { HOUR_START, HOUR_END } from "@/constants/time";
import { snapHour } from "@/utils/time";
import { extraGroupUSD } from "@/utils/currency";
import CalendarGrid from "@/components/calendar/CalendarGrid";
import SlotCreateModal from "@/components/calendar/SlotCreateModal";
import BudgetPanel from "@/components/budget/BudgetPanel";
import AgentPanel from "@/components/agent/AgentPanel";
import type { AgentChatMessage } from "@/components/agent/AgentPanel";
import { cn } from "@/lib/utils";
import BudgetView from "@/components/budget/BudgetView";
import TabBar from "@/components/TabBar";
import type { Tab } from "@/components/TabBar";
import AppHeader from "@/components/AppHeader";
import Toast from "@/components/Toast";
import RoomGate from "@/components/RoomGate";
import TasksView from "@/components/tasks/TasksView";
import type { Task, ToastAction, TripInfo, TripSpan } from "@/types";
import { initialDays } from "@/data/initialDays";
import { generateDays } from "@/utils/tripDays";

export default function App() {
  const [roomCode, setRoomCode] = useState<string | null>(null);

  // Auto-resume: the user↔room relation (last_active_at) is persisted in
  // Supabase (user_rooms), not localStorage, so this works across devices.
  // Only auto-enters when there's a SINGLE trip — no ambiguity to resolve.
  // With multiple trips, RoomGate's "Mis viajes" list is shown instead so the
  // user can see and pick among all of them (auto-jumping to just one would
  // hide the rest). A later explicit "leave" (onLeaveRoom) won't be undone by
  // this, since resumeAttempted stays true afterward.
  const { user, session, loading: authLoading, signInWithGoogle, signOut } = useAuth();
  const { rooms: userRooms, roomsLoading, addRoom, removeRoom } = useUserRooms(user, session?.access_token);
  const [resumeAttempted, setResumeAttempted] = useState(false);

  useEffect(() => {
    if (resumeAttempted) return;
    if (authLoading || roomsLoading) return;
    setResumeAttempted(true);
    if (user && userRooms.length === 1) setRoomCode(userRooms[0].room_code);
  }, [resumeAttempted, authLoading, roomsLoading, user, userRooms]);

  const [activeTab, setActiveTab] = useState<Tab>("calendar");
  const [pendingNew, setPendingNew] = useState<{ dayId: string; hour: number } | null>(null);
  const [slotDraft, setSlotDraft] = useState<{ dayId: string; hour: number; x: number; y: number; task: Task | null } | null>(null);
  const [sidePanel, setSidePanel] = useState<"budget" | "agent">("budget");
  const [agentMessages, setAgentMessages] = useState<AgentChatMessage[]>([]);

  const { days, selectedId, selectedEvent, setSelectedId, updateEvent, deleteEvent, addEvent, moveEvent, swapDays, loadDays, removeDaySpan, updateDaySpan } = useItinerary();
  const { extras, exchangeRate, setExchangeRate, updateExtra, addExtra, removeExtra, loadBudget } = useBudget();
  const [mockPeople, setMockPeople] = useState<MockPerson[]>([]);
  const [tripSpans, setTripSpans] = useState<TripSpan[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [trip, setTrip] = useState<TripInfo | null>(null);

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

  // Confirm a decision: choosing an option promotes the task to a real activity
  // (a calendar event if it's scheduled) plus a budget line, then removes the task.
  function chooseTaskOption(taskId: string, optionId: string) {
    const task = tasks.find((t) => t.id === taskId);
    const option = task?.options?.find((o) => o.id === optionId);
    if (!task || !option) return;

    let linkedEventId: string | undefined;
    if (task.dayId && task.start != null) {
      const end = task.end ?? Math.min(task.start + 1, HOUR_END);
      linkedEventId = addEvent(task.dayId, task.title, task.start, end, option.note ?? "", "logist");
    }
    if (option.amount && option.amount > 0) {
      addExtra({
        label: `${task.title}: ${option.label}`,
        amount: option.amount,
        currency: option.currency ?? "USD",
        splitMode: option.splitMode ?? "group",
        linkedEventId,
      });
    }
    deleteTask(taskId);
  }

  // Swap the whole contents of two days (events + spans in useItinerary) and
  // remap scheduled tasks' dayId, which live in this component's state.
  function swapDaysWithTasks(aId: string, bId: string) {
    if (aId === bId) return;
    swapDays(aId, bId);
    setTasks((prev) => prev.map((t) =>
      t.dayId === aId ? { ...t, dayId: bId } : t.dayId === bId ? { ...t, dayId: aId } : t,
    ));
  }

  const [toastAction, setToastAction] = useState<ToastAction | null>(null);
  const dismissToast = useCallback(() => setToastAction(null), []);

  const onRemoteUpdate = useCallback((payload: RoomPayload) => {
    loadDays(payload.days);
    loadBudget(payload.extras, payload.exchangeRate);
    if (payload.trip?.name)                setTrip(payload.trip);
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
    // Never autosave before the room's own payload has loaded: the local demo
    // state would overwrite the real trip.
    if (!connected) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      save({ days, extras, exchangeRate, trip: trip ?? undefined, mockPeople, tripSpans, tasks });
    }, 600);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, extras, exchangeRate, trip, mockPeople, tripSpans, tasks, roomCode, connected]);

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
    // Wait for the resume decision before rendering RoomGate, so a returning
    // user doesn't see a flash of "Mis viajes" before being auto-redirected.
    if (!resumeAttempted) {
      return (
        <div className="flex min-h-screen items-center justify-center text-[13px] text-muted-foreground">
          Cargando...
        </div>
      );
    }
    return (
      <RoomGate
        onEnter={setRoomCode}
        user={user}
        session={session}
        authLoading={authLoading}
        signInWithGoogle={signInWithGoogle}
        signOut={signOut}
        rooms={userRooms}
        addRoom={addRoom}
        removeRoom={removeRoom}
      />
    );
  }

  return (
    <div className="mx-auto max-w-[1280px] rounded-[14px] p-4">
      <AppHeader
        roomCode={roomCode}
        connected={connected}
        saveState={saveState}
        trip={trip}
        grandTotal={grandTotal}
        exchangeRate={exchangeRate}
        onReset={() => {
          if (confirm("¿Restablecer el itinerario? Se perderán las actividades del calendario.")) {
            const regenerated = trip ? generateDays(trip.startDate, trip.endDate) : null;
            loadDays(regenerated ?? initialDays);
            setTripSpans([]);
          }
        }}
        onLeaveRoom={() => setRoomCode(null)}
      />

      <TabBar active={activeTab} onChange={setActiveTab} pendingTaskCount={pendingTaskCount} />

      {activeTab === "calendar" && (
        <div className="flex items-start gap-3.5">
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
            onSwapDays={swapDaysWithTasks}
            pendingNew={pendingNew ?? (slotDraft && !slotDraft.task ? { dayId: slotDraft.dayId, hour: slotDraft.hour } : null)}
          />
          <div className="flex w-[300px] shrink-0 flex-col gap-2">
            <div className="flex overflow-hidden rounded-lg border border-border bg-card">
              {([["budget", "Presupuesto"], ["agent", "✨ Asistente"]] as const).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setSidePanel(id)}
                  className={cn(
                    "flex-1 cursor-pointer py-1.5 text-xs font-semibold transition-colors",
                    sidePanel === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {sidePanel === "agent" ? (
              <AgentPanel roomCode={roomCode} messages={agentMessages} setMessages={setAgentMessages} />
            ) : (
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
            )}
          </div>
        </div>
      )}

      {activeTab === "budget" && (
        <div className="flex flex-1 overflow-hidden">
          <BudgetView
            extras={extras}
            grandTotal={grandTotal}
            exchangeRate={exchangeRate}
            members={members}
            mockPeople={mockPeople}
            days={days}
            tasks={tasks}
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
          people={people}
          exchangeRate={exchangeRate}
          onAdd={(title) => addTask({ title })}
          onToggle={toggleTask}
          onUpdateTask={updateTask}
          onChooseOption={chooseTaskOption}
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
