"use client";
import type { Task, TaskDecides } from "@/types";
import { Button } from "@/components/ui/button";
import { VOTE_KINDS, VOTE_KIND_KEYS } from "@/constants/votes";
import { openVote } from "@/utils/votes";
import { cn } from "@/lib/utils";

// "🗳️ Votar fechas" / "🗳️ Votar destino", for the kinds with no open vote yet.
export default function StartVoteButtons({ tasks, onStart, className }: {
  tasks: Task[];
  onStart: (kind: TaskDecides) => void;
  className?: string;
}) {
  const kinds = VOTE_KIND_KEYS.filter((kind) => !openVote(tasks, kind));
  if (kinds.length === 0) return null;
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {kinds.map((kind) => (
        <Button key={kind} variant="outline" size="sm" onClick={() => onStart(kind)} className="rounded-full bg-card">
          <span aria-hidden>🗳️</span> {VOTE_KINDS[kind].start}
        </Button>
      ))}
    </div>
  );
}
