import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useItinerary } from "@/hooks/useItinerary";
import { useDragDrop } from "@/hooks/useDragDrop";
import { useBudget } from "@/hooks/useBudget";
import { useRoom } from "@/hooks/useRoom";
import { useTasks } from "@/hooks/useTasks";
import { useTripInfo } from "@/hooks/useTripInfo";
import { useTripOps } from "@/hooks/useTripOps";
import { useAuth } from "@/hooks/useAuth";
import { useUserRooms } from "@/hooks/useUserRooms";
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
import SyncNotice from "@/components/SyncNotice";
import MaintenanceBanner from "@/components/MaintenanceBanner";
import RoomGate from "@/components/RoomGate";
import TasksView from "@/components/tasks/TasksView";
import type { RoomPayload, Task, ToastAction } from "@/types";
import type { Row, TripTable } from "@/utils/tripRows";
import { LOCAL_MODE_ENABLED, LOCAL_ROOM_CODE } from "@/data/localMode";
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

  const localMode = roomCode === LOCAL_ROOM_CODE;
  // Beta: the assistant is owner-only, like resetting the itinerary (both enforced server-side too).
  const isOwner = localMode || userRooms.some((r) => r.room_code === roomCode && r.role === "owner");
  const canUseAgent = isOwner;

  useEffect(() => {
    if (resumeAttempted) return;
    if (authLoading || roomsLoading) return;
    setResumeAttempted(true);
    if (user && userRooms.length === 1) setRoomCode(userRooms[0].room_code);
  }, [resumeAttempted, authLoading, roomsLoading, user, userRooms]);

  // `?local=1` boots straight into local mode, skipping sign-in and the
  // auto-resume above (which is what redirects a returning user into their room).
  useEffect(() => {
    if (!LOCAL_MODE_ENABLED) return;
    if (!new URLSearchParams(window.location.search).has("local")) return;
    setResumeAttempted(true);
    setRoomCode(LOCAL_ROOM_CODE);
  }, []);

  const [activeTab, setActiveTab] = useState<Tab>("calendar");
  const [pendingNew, setPendingNew] = useState<{ dayId: string; hour: number } | null>(null);
  const [slotDraft, setSlotDraft] = useState<{ dayId: string; hour: number; x: number; y: number; task: Task | null } | null>(null);
  const [sidePanel, setSidePanel] = useState<"budget" | "agent">("budget");
  const [agentMessages, setAgentMessages] = useState<AgentChatMessage[]>([]);

  const ops = useTripOps(roomCode, session?.access_token, {
    adoptRow: (table, id, row) => adoptRow(table, id, row),
    applyHeader: (header) => applyHeader(header),
    resync: () => reload(),
  });
  const itinerary = useItinerary(ops.send);
  const budget = useBudget(ops.send);
  const taskState = useTasks(ops.send, ops.isKnown);
  const tripInfo = useTripInfo(ops.send);
  const { days, tripSpans, selectedId, selectedEvent, setSelectedId, updateEvent, deleteEvent, addEvent, moveEvent } = itinerary;
  const { extras, exchangeRate, setExchangeRate, updateExtra, addExtra, removeExtra } = budget;
  const { tasks, addTask, toggleTask, updateTask, deleteTask } = taskState;
  const { trip, mockPeople } = tripInfo;

  function applyHeader(header: Record<string, unknown>) {
    tripInfo.applyHeader(header);
    if (header.exchange_rate != null) budget.setRate(Number(header.exchange_rate));
  }

  function adoptRow(table: TripTable, id: string, row: Row | null) {
    if (table === "trip_expenses") budget.applyRow(id, row);
    else if (table === "trip_tasks" || table === "trip_task_options") taskState.applyRow(table, id, row);
    else if (table === "trip_travelers") tripInfo.applyRow(id, row);
    else itinerary.applyRow(table, id, row);
  }

  // Confirm a decision: the server turns the task into an event (if scheduled)
  // and an expense (if the option has a cost). The LOCAL demo does it in memory.
  function chooseTaskOption(taskId: string, optionId: string) {
    if (!localMode) return taskState.chooseOption(taskId, optionId);
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

  function swapDaysWithTasks(aId: string, bId: string) {
    if (aId === bId) return;
    itinerary.swapDays(aId, bId);
    taskState.swapTaskDays(aId, bId);
  }

  const [toastAction, setToastAction] = useState<ToastAction | null>(null);
  const dismissToast = useCallback(() => setToastAction(null), []);

  const { seedVersions } = ops;
  const { loadItinerary } = itinerary;
  const { loadBudget } = budget;
  const { loadTasks } = taskState;
  const { loadTripInfo } = tripInfo;
  const onLoad = useCallback((payload: RoomPayload) => {
    seedVersions(payload);
    loadItinerary(payload.days, payload.tripSpans);
    loadBudget(payload.extras, payload.exchangeRate);
    loadTripInfo(payload.trip, payload.mockPeople);
    loadTasks(payload.tasks);
  }, [seedVersions, loadItinerary, loadBudget, loadTripInfo, loadTasks]);

  const { connected, members, reload } = useRoom(roomCode, session?.access_token, {
    onLoad,
    onRow: (table, id, row, version) => {
      if (ops.acceptRemote(table, id, version, row === null)) adoptRow(table, id, row);
    },
    onHeader: applyHeader,
    onGone: () => setRoomCode(null),
    canResync: ops.idle,
  });

  // useRoom fetches nothing for LOCAL, so the mock payload is seeded here.
  // The demo is imported lazily and never in production builds.
  const localSeeded = useRef(false);
  useEffect(() => {
    // Inline NODE_ENV check (not LOCAL_MODE_ENABLED) so the bundler can drop the import.
    if (process.env.NODE_ENV === "production" || !localMode || localSeeded.current) return;
    localSeeded.current = true;
    import("@/data/mockRoom").then(({ mockRoomPayload }) => onLoad(mockRoomPayload));
  }, [localMode, onLoad]);

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
        onEnterLocal={LOCAL_MODE_ENABLED ? () => setRoomCode(LOCAL_ROOM_CODE) : undefined}
      />
    );
  }

  return (
    <div className="mx-auto max-w-[1280px] rounded-[14px] p-4">
      <AppHeader
        roomCode={roomCode}
        connected={connected || localMode}
        saveState={ops.syncState}
        trip={trip}
        grandTotal={grandTotal}
        exchangeRate={exchangeRate}
        onReset={isOwner ? () => {
          if (confirm("¿Restablecer el itinerario? Se perderán las actividades del calendario.")) {
            const regenerated = trip ? generateDays(trip.startDate, trip.endDate) : null;
            itinerary.resetItinerary(regenerated ?? days.map((d) => ({ ...d, events: [], spans: [] })));
          }
        } : undefined}
        onLeaveRoom={() => { localSeeded.current = false; setRoomCode(null); }}
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
            {canUseAgent && (
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
            )}

            {sidePanel === "agent" && canUseAgent ? (
              <AgentPanel roomCode={roomCode} accessToken={session?.access_token} messages={agentMessages} setMessages={setAgentMessages} />
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
                onAddTripSpan={itinerary.addTripSpan}
                onRemoveTripSpan={itinerary.removeTripSpan}
                onRemoveDaySpan={itinerary.removeDaySpan}
                onUpdateDaySpan={itinerary.updateDaySpan}
                onUpdateTripSpan={itinerary.updateTripSpan}
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
            onAddMockPerson={tripInfo.addMockPerson}
            onRemoveMockPerson={tripInfo.removeMockPerson}
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
      <SyncNotice message={ops.notice} onDismiss={ops.dismissNotice} />
      {ops.maintenance && <MaintenanceBanner />}

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
