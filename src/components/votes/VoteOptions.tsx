"use client";
import { X } from "lucide-react";
import type { TaskOption } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import OptionVote, { type OptionVoting } from "@/components/tasks/OptionVote";
import { leader, namesText, optionDayCount, voteCount, voterNames } from "@/utils/votes";

interface VoteOptionsProps {
  options: TaskOption[];
  voting: OptionVoting;
  // The vote is over: no more votes, removals or choosing; `chosen` is what it settled on.
  closed: boolean;
  chosenId?: string;
  onRemove: (optionId: string) => void;
  // Owner only: opens the closing dialog with this option.
  onChoose?: (optionId: string) => void;
}

// The options of a date or destination vote, each with its ✋ (back as many as you like).
export default function VoteOptions({ options, voting, closed, chosenId, onRemove, onChoose }: VoteOptionsProps) {
  const memberIds = voting.members.map((m) => m.userId);
  const top = leader(options, memberIds);

  function remove(o: TaskOption) {
    const votes = voteCount(o, memberIds);
    if (votes > 0 && !confirm(`“${o.label}” tiene ${votes} ${votes === 1 ? "voto" : "votos"}. ¿Quitarla de todas formas?`)) return;
    onRemove(o.id);
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {options.map((o) => {
        const days = optionDayCount(o);
        const voters = voterNames(o, voting.members, voting.voter);
        const badge = closed ? (chosenId === o.id ? "Elegida" : null) : top?.id === o.id ? "Más votada" : null;
        return (
          <li key={o.id} className="flex items-center gap-2 rounded-lg border border-border bg-secondary px-3 py-2">
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-1.5">
                <span className="truncate text-sm font-medium">{o.label}</span>
                {badge && (
                  <Badge variant="outline" className="h-4 rounded-full border-primary bg-primary/15 px-1.5 text-[9.5px] font-semibold text-emerald-800">
                    {badge}
                  </Badge>
                )}
              </div>
              {(days || voters.length > 0) && (
                <div className="truncate text-[11px] text-muted-foreground">
                  {[days && `${days} ${days === 1 ? "día" : "días"}`, voters.length > 0 && `✋ ${namesText(voters)}`].filter(Boolean).join(" · ")}
                </div>
              )}
            </div>
            <OptionVote option={o} voting={voting} disabled={closed} />
            {!closed && onChoose && (
              <Button size="xs" onClick={() => onChoose(o.id)} className="font-semibold" title="Cerrar la votación con esta opción">
                Elegir
              </Button>
            )}
            {!closed && (
              <button
                onClick={() => remove(o)}
                aria-label={`Quitar “${o.label}”`}
                title="Quitar opción"
                className="cursor-pointer rounded p-0.5 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
