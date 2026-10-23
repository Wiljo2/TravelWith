import type { IsKnown, SendOp } from "@/hooks/useTripOps";
import type { Notify } from "@/hooks/useSnackbar";
import type { Day, Task, TaskDecides, TaskOption, TripInfo } from "@/types";
import { LIMITS } from "@/constants/limits";
import { VOTE_KINDS, VOTE_TASK_CAT } from "@/constants/votes";
import { alreadyProposed, closedVoteChanges, isVote, openVote, withVote } from "@/utils/votes";

export type ProposedOption = Pick<TaskOption, "label" | "startDate" | "endDate">;

interface VoteDeps {
  send: SendOp;
  isKnown: IsKnown;
  notify?: Notify;
  // Reload the trip: after a close that lost a conflict, so the optimistic days and header go back.
  resync: () => void;
  tasks: Task[];
  addTask: (task: Partial<Task> & { title: string }, message?: string) => void;
  updateTask: (id: string, patch: Partial<Task>) => void;
  patchOption: (optionId: string, update: (o: TaskOption) => TaskOption) => void;
  patchTasks: (update: (t: Task) => Task) => void;
  trip: TripInfo | null;
  applyHeader: (header: Record<string, unknown>) => void;
  loadDays: (days: Day[]) => void;
}

// Group votes. Votes on any option live on the options (useTasks state): a
// toggle shows at once and sends one unguarded op; the op queue adopts the
// response row, which holds every vote committed before ours. Options the
// server doesn't know yet (no label) and the LOCAL room only vote in memory.
// Date and destination votes are "Por decidir" tasks with `decides`; the owner
// closes one, which sets the trip dates (rebuilding the days, like resetting
// the itinerary) or destination. The same optimistic changes are the whole
// close in the LOCAL room, where nothing is sent.
export function useVotes(deps: VoteDeps) {
  const { send, isKnown, notify, tasks } = deps;

  function vote(optionId: string, voter: string, on: boolean) {
    deps.patchOption(optionId, (o) => withVote(o, voter, on));
    if (isKnown("trip_task_options", optionId)) send("taskOption.vote", { id: optionId, on });
  }

  function startVote(kind: TaskDecides) {
    if (openVote(tasks, kind)) return;
    deps.addTask({ title: VOTE_KINDS[kind].title, cat: VOTE_TASK_CAT, decides: kind }, "Votación creada");
  }

  function proposeOption(taskId: string, proposal: ProposedOption) {
    const task = tasks.find((t) => t.id === taskId);
    if (!task || !isVote(task) || task.done) return;
    const options = task.options ?? [];
    if (options.length >= LIMITS.voteOptions || !proposal.label.trim() || alreadyProposed(options, proposal)) return;
    deps.updateTask(taskId, { options: [...options, { id: crypto.randomUUID(), ...proposal, label: proposal.label.trim() }] });
  }

  function removeOption(taskId: string, optionId: string) {
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.done) return;
    deps.updateTask(taskId, { options: (task.options ?? []).filter((o) => o.id !== optionId) });
  }

  // `replace`: the owner confirmed that the itinerary's activities are deleted.
  function closeVote(taskId: string, optionId: string, replace: boolean) {
    const task = tasks.find((t) => t.id === taskId);
    const option = task?.options?.find((o) => o.id === optionId);
    if (!task || !option || !isVote(task) || task.done) return;
    const changes = closedVoteChanges(task, option, deps.trip);
    if (!changes) return;
    deps.applyHeader(changes.header);
    const { days } = changes;
    if (days) {
      deps.loadDays(days);
      // Days that disappear send their scheduled tasks back to the backlog (the server's foreign keys do the same).
      const kept = new Set(days.map((d) => d.id));
      deps.patchTasks((t) => (t.dayId && !kept.has(t.dayId) ? { ...t, dayId: undefined, start: undefined, end: undefined } : t));
    }
    deps.patchTasks((t) => (t.id === taskId ? { ...t, done: true } : t));
    send("task.closeVote", { taskId, optionId, ...(replace ? { replaceItinerary: true } : {}) }).then((outcome) => {
      // A failure already reloads the trip (useTripOps); a conflict only adopts the task.
      if (outcome === "conflict") deps.resync();
      if (outcome !== "ok") return;
      notify?.({ message: task.decides === "dates" ? "Fechas elegidas: el itinerario quedó listo" : "Destino elegido" });
    });
  }

  return { vote, startVote, proposeOption, removeOption, closeVote };
}

export type VoteActions = Omit<ReturnType<typeof useVotes>, "vote">;
