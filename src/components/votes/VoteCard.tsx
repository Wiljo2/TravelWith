"use client";
import { useState } from "react";
import { X } from "lucide-react";
import type { TripInfo } from "@/types";
import type { VoteActions } from "@/hooks/useVotes";
import type { OptionVoting } from "@/components/tasks/OptionVote";
import { PANEL } from "@/components/home/shared";
import CloseVoteDialog from "@/components/votes/CloseVoteDialog";
import ProposeOption from "@/components/votes/ProposeOption";
import VoteOptions from "@/components/votes/VoteOptions";
import { VOTE_KINDS } from "@/constants/votes";
import { cn } from "@/lib/utils";
import { chosenOption, totalVotes, type VoteTask } from "@/utils/votes";

// What a view needs to run date and destination votes; only the owner closes them.
export interface VoteControls extends VoteActions {
  canClose: boolean;
}

interface VoteCardProps {
  task: VoteTask;
  trip: TripInfo | null;
  // Activities a dates close would delete.
  activityCount: number;
  voting: OptionVoting;
  votes: VoteControls;
  // Owner only (Pendientes): deletes the vote with its options and votes.
  onDelete?: () => void;
  className?: string;
}

// A "¿Cuándo viajamos?" / "¿A dónde vamos?" vote: options with ✋, proposals
// from anyone, and the owner's "Elegir". Once closed it shows what was chosen.
export default function VoteCard({ task, trip, activityCount, voting, votes, onDelete, className }: VoteCardProps) {
  const [closing, setClosing] = useState<string | null>(null);
  const kind = VOTE_KINDS[task.decides];
  const options = task.options ?? [];
  const memberIds = voting.members.map((m) => m.userId);
  const count = totalVotes(options, memberIds);
  const chosen = chosenOption(task, trip);
  const hint = task.done
    ? chosen ? `Votación cerrada: ${chosen.label}.` : "Votación cerrada."
    : options.length === 0
      ? kind.empty
      : `${count} ${count === 1 ? "voto" : "votos"}. Voten con ✋ las que les sirvan (pueden votar por varias).`;

  function remove() {
    if (onDelete && confirm(`¿Borrar la votación “${task.title}”? Se pierden sus opciones y votos.`)) onDelete();
  }

  return (
    <section className={cn(PANEL, task.done && "opacity-70", className)}>
      <div className="mb-1 flex items-start justify-between gap-2">
        <h2 className="text-[15px] font-semibold">
          <span aria-hidden>🗳️ </span>{task.title}
        </h2>
        {onDelete && (
          <button onClick={remove} aria-label="Borrar la votación" title="Borrar la votación"
            className="cursor-pointer rounded p-0.5 text-muted-foreground opacity-60 hover:opacity-100">
            <X className="size-4" />
          </button>
        )}
      </div>
      <p className="mb-3 text-[12.5px] text-muted-foreground">{hint}</p>

      <div className="flex flex-col gap-2">
        {options.length > 0 && (
          <VoteOptions
            options={options}
            voting={voting}
            closed={task.done}
            chosenId={chosen?.id}
            onRemove={(optionId) => votes.removeOption(task.id, optionId)}
            onChoose={votes.canClose ? setClosing : undefined}
          />
        )}
        {!task.done && (
          <ProposeOption kind={task.decides} options={options} onPropose={(option) => votes.proposeOption(task.id, option)} />
        )}
        {!task.done && !votes.canClose && options.length > 0 && (
          <p className="text-[11px] text-muted-foreground">El creador del viaje elige cuando estén listos.</p>
        )}
      </div>

      {closing && (
        <CloseVoteDialog
          task={task}
          optionId={closing}
          memberIds={memberIds}
          trip={trip}
          activityCount={activityCount}
          onConfirm={(optionId, replace) => votes.closeVote(task.id, optionId, replace)}
          onClose={() => setClosing(null)}
        />
      )}
    </section>
  );
}
