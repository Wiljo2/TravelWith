import type { IsKnown, SendOp } from "@/hooks/useTripOps";
import type { TaskOption } from "@/types";
import { withVote } from "@/utils/votes";

type PatchOption = (optionId: string, update: (o: TaskOption) => TaskOption) => void;

// Group votes on task options. The votes live on the options (useTasks state):
// a toggle shows at once and sends one unguarded op; the op queue adopts the
// response row, which holds every vote committed before ours. Options the
// server doesn't know yet (no label) and the LOCAL room only vote in memory.
export function useVotes(send: SendOp, isKnown: IsKnown, patchOption: PatchOption) {
  function vote(optionId: string, voter: string, on: boolean) {
    patchOption(optionId, (o) => withVote(o, voter, on));
    if (isKnown("trip_task_options", optionId)) send("taskOption.vote", { id: optionId, on });
  }

  return { vote };
}
