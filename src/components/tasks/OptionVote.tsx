"use client";
import type { RoomMember, TaskOption } from "@/types";
import { hasVoted, voteCount } from "@/utils/votes";
import { cn } from "@/lib/utils";

// Who votes and where the vote goes; shared by every option of the trip.
export interface OptionVoting {
  voter: string;
  members: RoomMember[];
  onVote: (optionId: string, on: boolean) => void;
}

interface OptionVoteProps {
  option: TaskOption;
  voting: OptionVoting;
  disabled?: boolean;
}

// ✋ toggle with the option's vote count (approval voting: back as many as you like).
export default function OptionVote({ option, voting, disabled }: OptionVoteProps) {
  const mine = hasVoted(option, voting.voter);
  const count = voteCount(option, voting.members.map((m) => m.userId));
  return (
    <button
      onClick={() => voting.onVote(option.id, !mine)}
      disabled={disabled}
      aria-pressed={mine}
      aria-label={`${mine ? "Quitar mi voto" : "Votar por esta opción"} (${count} ${count === 1 ? "voto" : "votos"})`}
      title={mine ? "Quitar mi voto" : "Votar por esta opción (puedes votar por varias)"}
      className={cn(
        "flex shrink-0 cursor-pointer items-center gap-1 rounded-md border px-2 py-0.5 text-[10.5px] font-semibold disabled:cursor-not-allowed disabled:opacity-40",
        mine ? "border-primary bg-primary/15 text-emerald-800" : "border-border bg-card text-muted-foreground hover:text-foreground",
      )}
    >
      <span aria-hidden>✋</span>
      {count > 0 ? count : "Votar"}
    </button>
  );
}
