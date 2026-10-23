import { useState, useCallback, useEffect, useMemo } from "react";
import { useDragDrop } from "@/hooks/useDragDrop";
import { useTripSession } from "@/hooks/useTripSession";
import { useTripData } from "@/hooks/useTripData";
import { useSharedLink } from "@/hooks/useSharedLink";
import { useStartChoices } from "@/hooks/useStartChoices";
import StartChoices from "@/components/onboarding/StartChoices";
import DocumentsPanel from "@/components/documents/DocumentsPanel";
import { chooseOption } from "@/utils/taskDecision";
import { HOUR_START, HOUR_END } from "@/constants/time";
import { snapHour, fmtHour } from "@/utils/time";
import { extraGroupUSD } from "@/utils/currency";
import { countByEvent, placedInsights } from "@/utils/insights";
import SlotCreateModal from "@/components/calendar/SlotCreateModal";
import AgentPanel from "@/components/agent/AgentPanel";
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
import Snackbar from "@/components/Snackbar";
import { useSnackbar } from "@/hooks/useSnackbar";
import RoomGate from "@/components/RoomGate";
import TasksView from "@/components/tasks/TasksView";
import type { OptionVoting } from "@/components/tasks/OptionVote";
import type { VoteControls } from "@/components/votes/VoteCard";
import IdeasTab from "@/components/ideas/IdeasTab";
import ItineraryMap from "@/components/map/ItineraryMap";
import type { AgentChatMessage } from "@/types";
import { LOCAL_MODE_ENABLED, LOCAL_ROOM_CODE, openLocalDemo, type LocalVariant } from "@/data/localMode";
import { generateDays, hasDates, tripDayIndex } from "@/utils/tripDays";
import { useIsMobile } from "@/hooks/useMediaQuery";
import type { ItinerarySheet } from "@/components/itinerary/ItineraryView";
import ItineraryTab, { type SlotDraft } from "@/components/itinerary/ItineraryTab";
import ActivityDetail from "@/components/itinerary/ActivityDetail";
import PasswordRecoveryDialog from "@/components/auth/PasswordRecoveryDialog";

export default function App() {
  const { roomCode, setRoomCode, resumeAttempted, localMode, auth, userRooms: rooms, invite } = useTripSession();
  const { user, session, loading: authLoading, recovering, updatePassword, signOut } = auth;
  const recoveryDialog = <PasswordRecoveryDialog open={recovering} onSubmit={updatePassword} />;
  const { rooms: userRooms, addRoom, removeRoom } = rooms;
  // Beta: the assistant is owner-only, like resetting the itinerary (both enforced server-side too).
  const isOwner = localMode || userRooms.some((r) => r.room_code === roomCode && r.role === "owner");
  const canUseAgent = isOwner;

  const [activeTab, setActiveTab] = useState<Tab>("home");
  const shared = useSharedLink();
  // A link shared from the phone lands on the ideas of the open trip.
  useEffect(() => { if (shared.text && roomCode) setActiveTab("ideas"); }, [shared.text, roomCode]); // eslint-disable-line react-hooks/set-state-in-effect -- follows the shared link
  const [slotDraft, setSlotDraft] = useState<SlotDraft | null>(null);
  const isMobile = useIsMobile();
  const [sheet, setSheet] = useState<ItinerarySheet | null>(null);
  const [agentMessages, setAgentMessages] = useState<AgentChatMessage[]>([]);
  const start = useStartChoices({ roomCode, mobile: isMobile, canUseAssistant: canUseAgent && !localMode, chatLength: agentMessages.length, setActiveTab, setSheet, share: shared.share });

  const { snack, notify, dismiss: dismissSnack } = useSnackbar();
  const data = useTripData(roomCode, session?.access_token, localMode, () => setRoomCode(null), notify);
  const { ops, itinerary, budget, taskState, tripInfo, ideasApi, geoApi, docs, payloadNow } = data;
  const { days, tripSpans, selectedEvent, setSelectedId, updateEvent, deleteEvent, addEvent, moveEvent, addTripSpan, removeTripSpan } = itinerary;
  const { extras, exchangeRate, setExchangeRate, updateExtra, commitExtra, addExtra, removeExtra } = budget;
  const { tasks, addTask, toggleTask, updateTask, deleteTask } = taskState;
  const { trip, mockPeople, addMockPerson, removeMockPerson } = tripInfo;
  const { ideas } = ideasApi;
  // Advice from the videos that "Analizar con Claude" placed on the plan.
  const placed = useMemo(() => placedInsights(ideas, ideasApi.planInsightLinks), [ideas, ideasApi.planInsightLinks]);
  const tipsByEvent = useMemo(() => countByEvent(placed), [placed]);
  const { documents, addDocument, updateDocument, removeDocument } = docs;
  const { connected, offlineSince, members } = data.room;
  // Option votes are keyed like idea votes: the signed-in user, "local" without an account.
  const voter = user?.id ?? "local";
  const voting: OptionVoting = { voter, members, onVote: (optionId, on) => data.votes.vote(optionId, voter, on) };
  // Anyone proposes and votes; only the owner closes a date or destination vote (enforced server-side too).
  const votes: VoteControls = { ...data.votes, canClose: isOwner };

  // The server turns the task into an event and an expense in one transaction;
  // the LOCAL demo does it in memory.
  const chooseTaskOption = (taskId: string, optionId: string) =>
    localMode ? chooseOption(tasks, taskId, optionId, { addEvent, addExtra, deleteTask }) : taskState.chooseOption(taskId, optionId);

  const { save } = data;

  const [activityOpen, setActivityOpen] = useState(false);

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

  const drag = useDragDrop(
    (fromDayId, toDayId, ev, droppedHour) => {
      const dur = ev.end - ev.start;
      const newStart = snapHour(droppedHour, dur, HOUR_START, HOUR_END);
      const newEnd = newStart + dur;
      moveEvent(fromDayId, toDayId, ev, newStart);
      notify({
        message: `${ev.title} movida · ${fmtHour(newStart)} – ${fmtHour(newEnd)}`,
        action: { label: "Deshacer", run: () => moveEvent(toDayId, fromDayId, { ...ev, start: newStart, end: newEnd }, ev.start) },
      });
    }
  );

  function enterLocal(variant: LocalVariant) {
    if (variant === "new") return window.location.assign("/?local=new");
    openLocalDemo();
    setRoomCode(LOCAL_ROOM_CODE);
  }

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
      <>
        {recoveryDialog}
        <RoomGate
          onEnter={setRoomCode}
          user={user}
          session={session}
          authLoading={authLoading}
          signIn={auth}
          signOut={signOut}
          rooms={userRooms}
          addRoom={addRoom}
          removeRoom={removeRoom}
          onEnterLocal={LOCAL_MODE_ENABLED ? enterLocal : undefined}
          invite={invite}
          onCreated={start.markCreated}
        />
      </>
    );
  }

  const todayIdx = hasDates(trip) ? tripDayIndex(trip.startDate, days.length) : undefined;
  const detail = selectedEvent && (
    <ActivityDetail
      key={selectedEvent.ev.id}
      selected={selectedEvent}
      place={geoApi.eventPlaces[selectedEvent.ev.id]}
      tips={placed.filter((p) => p.link.eventId === selectedEvent.ev.id)}
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
      initialDraft={start.agentDraft}
    />
  );

  return (
    <div className="mx-auto max-w-[1200px] px-4 pb-[calc(env(safe-area-inset-bottom)+84px)] pt-[max(16px,env(safe-area-inset-top))] md:px-8 md:py-7">
      <AppHeader
        roomCode={roomCode}
        connected={connected || localMode}
        saveState={ops.syncState}
        lastSavedAt={ops.lastSavedAt}
        trip={trip}
        onReset={isOwner && (!trip || hasDates(trip)) ? () => {
          if (confirm("¿Restablecer el itinerario? Se perderán las actividades del calendario.")) {
            const regenerated = hasDates(trip) ? generateDays(trip.startDate, trip.endDate) : null;
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
          roomCode={roomCode} loaded={data.room.loaded} memberCount={members.length} voting={voting} votes={votes}
          expenseCount={extras.length} documentCount={documents.length}
          trip={trip}
          days={days}
          tasks={tasks}
          ideas={ideas}
          grandTotal={grandTotal}
          people={people}
          exchangeRate={exchangeRate}
          onNavigate={setActiveTab}
          placed={placed}
          documents={<DocumentsPanel documents={documents} onAdd={addDocument} onUpdate={updateDocument} onRemove={removeDocument} />}
        />
      )}

      {activeTab === "calendar" && (
        <ItineraryTab
          mobile={isMobile}
          trip={trip}
          itinerary={itinerary}
          taskState={taskState}
          drag={drag}
          todayIdx={todayIdx}
          tipsByEvent={tipsByEvent}
          detail={detail}
          agent={agentPanel}
          focusAgent={!!start.agentDraft}
          sheet={sheet}
          onSheet={setSheet}
          onSelect={handleSelect}
          slotDraft={slotDraft}
          onSlotDraft={setSlotDraft}
          onStartVote={votes.startVote}
          onOpenVotes={() => setActiveTab("home")}
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
          currentPayload={payloadNow} save={save}
          onOpenEvent={(id) => { setActiveTab("calendar"); handleSelect(id); }}
          onOpenItinerary={() => setActiveTab("calendar")}
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
          sharedText={shared.text}
          onSharedDone={shared.clear}
          tasks={tasks}
          onAddTask={(task) => addTask(task)}
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
            onUpdateExtra={commitExtra}
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
          trip={trip}
          people={people}
          exchangeRate={exchangeRate}
          voting={voting}
          votes={votes}
          onAdd={(title) => addTask({ title })}
          onToggle={toggleTask}
          onUpdateTask={updateTask}
          onChooseOption={chooseTaskOption}
          onDelete={deleteTask}
        />
      )}

      {start.choices && <StartChoices {...start.choices} />}
      <Snackbar snack={snack} onDismiss={dismissSnack} />
      <SyncNotice message={ops.notice} onDismiss={ops.dismissNotice} />
      {ops.maintenance && <MaintenanceBanner />}
      {recoveryDialog}

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
