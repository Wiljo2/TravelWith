import { useState, useCallback, useMemo } from "react";
import { useDragDrop } from "@/hooks/useDragDrop";
import { useTripSession } from "@/hooks/useTripSession";
import { useTripData } from "@/hooks/useTripData";
import DocumentsPanel from "@/components/documents/DocumentsPanel";
import { chooseOption } from "@/utils/taskDecision";
import { HOUR_START, HOUR_END } from "@/constants/time";
import { snapHour } from "@/utils/time";
import { extraGroupUSD } from "@/utils/currency";
import CalendarGrid from "@/components/calendar/CalendarGrid";
import SlotCreateModal from "@/components/calendar/SlotCreateModal";
import AgentPanel from "@/components/agent/AgentPanel";
import type { AgentChatMessage } from "@/components/agent/AgentPanel";
import BudgetView from "@/components/budget/BudgetView";
import HomeView from "@/components/home/HomeView";
import TabBar from "@/components/TabBar";
import type { Tab } from "@/components/TabBar";
import AppHeader from "@/components/AppHeader";
import OfflineBanner from "@/components/OfflineBanner";
import ActivityDialog from "@/components/ActivityDialog";
import SyncNotice from "@/components/SyncNotice";
import MaintenanceBanner from "@/components/MaintenanceBanner";
import { downloadTripPdf } from "@/lib/tripPdf";
import Toast from "@/components/Toast";
import RoomGate from "@/components/RoomGate";
import TasksView from "@/components/tasks/TasksView";
import IdeasTab from "@/components/ideas/IdeasTab";
import ItineraryMap from "@/components/map/ItineraryMap";
import type { Task, ToastAction } from "@/types";
import { LOCAL_MODE_ENABLED, LOCAL_ROOM_CODE } from "@/data/localMode";
import { generateDays, tripDayIndex } from "@/utils/tripDays";
import { useIsMobile } from "@/hooks/useMediaQuery";
import ItineraryView from "@/components/itinerary/ItineraryView";
import type { ItinerarySheet } from "@/components/itinerary/ItineraryView";
import ItineraryAgenda from "@/components/itinerary/ItineraryAgenda";
import ActivityDetail from "@/components/itinerary/ActivityDetail";
import SpansManager from "@/components/itinerary/SpansManager";

export default function App() {
  const { roomCode, setRoomCode, resumeAttempted, localMode, auth, userRooms: rooms } = useTripSession();
  const { user, session, loading: authLoading, signInWithGoogle, signOut } = auth;
  const { rooms: userRooms, addRoom, removeRoom } = rooms;
  // Beta: the assistant is owner-only, like resetting the itinerary (both enforced server-side too).
  const isOwner = localMode || userRooms.some((r) => r.room_code === roomCode && r.role === "owner");
  const canUseAgent = isOwner;

  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [slotDraft, setSlotDraft] = useState<{ dayId: string; hour: number; x: number; y: number; task: Task | null } | null>(null);
  const isMobile = useIsMobile();
  const [sheet, setSheet] = useState<ItinerarySheet | null>(null);
  const [agentMessages, setAgentMessages] = useState<AgentChatMessage[]>([]);

  const data = useTripData(roomCode, session?.access_token, localMode, () => setRoomCode(null));
  const { ops, itinerary, budget, taskState, tripInfo, ideasApi, geoApi, docs, payloadNow } = data;
  const { days, tripSpans, selectedId, selectedEvent, setSelectedId, updateEvent, deleteEvent, addEvent, moveEvent, swapDays, setDaySub, removeDaySpan, updateDaySpan, addTripSpan, removeTripSpan, updateTripSpan } = itinerary;
  const { extras, exchangeRate, setExchangeRate, updateExtra, addExtra, removeExtra } = budget;
  const { tasks, addTask, toggleTask, updateTask, deleteTask, swapTaskDays } = taskState;
  const { trip, mockPeople, addMockPerson, removeMockPerson } = tripInfo;
  const { ideas } = ideasApi;
  const { documents, addDocument, updateDocument, removeDocument } = docs;
  const { connected, offlineSince, members } = data.room;

  // The server turns the task into an event and an expense in one transaction;
  // the LOCAL demo does it in memory.
  const chooseTaskOption = (taskId: string, optionId: string) =>
    localMode ? chooseOption(tasks, taskId, optionId, { addEvent, addExtra, deleteTask }) : taskState.chooseOption(taskId, optionId);

  const { save } = data;

  // Swap the whole contents of two days (events + spans) and their scheduled tasks.
  function swapDaysWithTasks(aId: string, bId: string) {
    if (aId === bId) return;
    swapDays(aId, bId);
    swapTaskDays(aId, bId);
  }

  const [toastAction, setToastAction] = useState<ToastAction | null>(null);
  const [activityOpen, setActivityOpen] = useState(false);
  const dismissToast = useCallback(() => setToastAction(null), []);

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
    if (id !== null && isMobile) setSheet("detail");
  }

  function openSlot(dayId: string, hour: number, x: number, y: number) {
    setSelectedId(null);
    setSlotDraft({ dayId, hour, x, y, task: null });
  }

  const { onDragStart, beginDrag, cancelDrag, onDragEnter, onDragMove, onDropInDay, onDragEnd, dragTarget, dragPreview } = useDragDrop(
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
        <div className="flex min-h-dvh items-center justify-center text-[13px] text-muted-foreground">
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

  const todayIdx = trip ? tripDayIndex(trip.startDate, days.length) : undefined;
  const detail = selectedEvent && (
    <ActivityDetail
      key={selectedEvent.ev.id}
      selected={selectedEvent}
      place={geoApi.eventPlaces[selectedEvent.ev.id]}
      days={days}
      extras={extras}
      tripSpans={tripSpans}
      documents={documents}
      people={people}
      exchangeRate={exchangeRate}
      onUpdate={updateEvent}
      onDelete={() => { deleteEvent(); setSheet(null); }}
      onMoveDay={(toDayId) => moveEvent(selectedEvent.dayId, toDayId, selectedEvent.ev, selectedEvent.ev.start)}
      onLinkExtra={linkExtra}
      onAddExtra={addExtra}
      onRemoveExtra={removeExtra}
      onAddTripSpan={addTripSpan}
      onRemoveTripSpan={removeTripSpan}
    />
  );
  const agentPanel = canUseAgent && (
    <AgentPanel
      roomCode={roomCode}
      accessToken={session?.access_token}
      messages={agentMessages}
      setMessages={setAgentMessages}
      className={isMobile ? "h-[75dvh] rounded-none border-x-0 border-b-0" : "rounded-2xl border-0 shadow-[0_1px_2px_rgba(0,0,0,.04)] ring-1 ring-border/70"}
      embedded={isMobile}
    />
  );

  return (
    <div className="mx-auto max-w-[1200px] px-4 pb-[calc(env(safe-area-inset-bottom)+84px)] pt-[max(16px,env(safe-area-inset-top))] md:px-8 md:py-7">
      <AppHeader
        roomCode={roomCode}
        connected={connected || localMode}
        saveState={ops.syncState}
        trip={trip}
        onReset={isOwner ? () => {
          if (confirm("¿Restablecer el itinerario? Se perderán las actividades del calendario.")) {
            const regenerated = trip ? generateDays(trip.startDate, trip.endDate) : null;
            itinerary.resetItinerary(regenerated ?? days.map((d) => ({ ...d, events: [], spans: [] })));
          }
        } : undefined}
        onLeaveRoom={() => { data.resetLocalSeed(); setRoomCode(null); }}
        onOpenActivity={localMode ? undefined : () => setActivityOpen(true)}
        onDownloadPdf={(kind) => downloadTripPdf(kind, { trip, days, documents, travelers: [...members, ...mockPeople].map((p) => p.name) })}
      />
      {!localMode && <ActivityDialog open={activityOpen} onOpenChange={setActivityOpen} roomCode={roomCode} accessToken={session?.access_token} />}
      {offlineSince && <OfflineBanner since={offlineSince} />}

      <TabBar active={activeTab} onChange={setActiveTab} pendingTaskCount={pendingTaskCount} />

      {activeTab === "home" && (
        <HomeView
          trip={trip}
          days={days}
          tasks={tasks}
          ideas={ideas}
          grandTotal={grandTotal}
          people={people}
          exchangeRate={exchangeRate}
          onNavigate={setActiveTab}
          documents={<DocumentsPanel documents={documents} onAdd={addDocument} onUpdate={updateDocument} onRemove={removeDocument} />}
        />
      )}

      {activeTab === "calendar" && (
        <ItineraryView
          mobile={isMobile}
          selectedId={selectedId}
          detail={detail || null}
          agent={agentPanel}
          sheet={sheet}
          onOpenSheet={setSheet}
          onCloseSheet={() => { setSheet(null); setSelectedId(null); }}
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
              onSelect={handleSelect}
              onAdd={openSlot}
              onEditTask={(task, x, y) => setSlotDraft({ dayId: task.dayId!, hour: task.start ?? 8, x, y, task })}
              onToggleTask={toggleTask}
              onSetDaySub={setDaySub}
            />
          }
          grid={
          <CalendarGrid
            days={days}
            tripSpans={tripSpans}
            tasks={tasks}
            onDragStart={onDragStart}
            onTouchDragStart={beginDrag}
            onTouchDragCancel={cancelDrag}
            onDragEnter={onDragEnter}
            onDragMove={onDragMove}
            onDrop={onDropInDay}
            onDragEnd={onDragEnd}
            onSelect={handleSelect}
            selectedId={selectedId}
            dragTarget={dragTarget}
            dragPreview={dragPreview}
            onAddEvent={openSlot}
            onToggleTask={toggleTask}
            onEditTask={(task, x, y) => setSlotDraft({ dayId: task.dayId!, hour: task.start ?? 8, x, y, task })}
            onSwapDays={swapDaysWithTasks}
            onSetDaySub={setDaySub}
            pendingNew={slotDraft && !slotDraft.task ? { dayId: slotDraft.dayId, hour: slotDraft.hour } : null}
            initialDayIdx={todayIdx}
          />
          }
        />
      )}

      {activeTab === "map" && (
        <ItineraryMap
          geo={geoApi}
          days={days}
          todayIdx={todayIdx}
          roomCode={roomCode}
          accessToken={session?.access_token}
          localMode={localMode}
          currentPayload={payloadNow}
          save={save}
          onOpenEvent={(id) => { setActiveTab("calendar"); handleSelect(id); }}
        />
      )}

      {activeTab === "ideas" && (
        <IdeasTab
          api={ideasApi}
          roomCode={roomCode}
          localMode={localMode}
          mobile={isMobile}
          user={user}
          accessToken={session?.access_token}
          days={days}
          trip={trip}
          currentPayload={payloadNow}
          save={save}
        />
      )}

      {activeTab === "budget" && (
        <div>
          <BudgetView
            extras={extras}
            grandTotal={grandTotal}
            exchangeRate={exchangeRate}
            members={members}
            mockPeople={mockPeople}
            days={days}
            tasks={tasks}
            documents={documents}
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
      <SyncNotice message={ops.notice} onDismiss={ops.dismissNotice} />
      {ops.maintenance && <MaintenanceBanner />}

      {slotDraft && (
        <SlotCreateModal
          x={slotDraft.x}
          y={slotDraft.y}
          dayLabel={days.find((d) => d.id === slotDraft.dayId)?.label ?? ""}
          hour={slotDraft.hour}
          existing={slotDraft.task}
          onSaveActivity={({ title, note, cat, start, end, mapsUrl }) => {
            addEvent(slotDraft.dayId, title, start, end, note, cat, mapsUrl);
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
