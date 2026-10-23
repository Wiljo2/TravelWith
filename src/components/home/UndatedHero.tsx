"use client";
import { Button } from "@/components/ui/button";
import VoteCard, { type VoteControls } from "@/components/votes/VoteCard";
import type { OptionVoting } from "@/components/tasks/OptionVote";
import { PANEL } from "@/components/home/shared";
import { VOTE_KIND_KEYS } from "@/constants/votes";
import { UNDATED_LABEL } from "@/utils/tripDays";
import { cn } from "@/lib/utils";
import type { TripInfo } from "@/types";
import type { VoteTask } from "@/utils/votes";

interface UndatedHeroProps {
  trip: TripInfo;
  openVotes: VoteTask[];
  // Activities a dates close would delete (only legacy undated trips have days).
  activityCount: number;
  voting: OptionVoting;
  votes: VoteControls;
}

// Inicio's top while the trip has no dates: the open votes take the hero's
// place, dates first; with no dates vote open, the hero offers to start one.
export default function UndatedHero({ trip, openVotes, activityCount, voting, votes }: UndatedHeroProps) {
  const sorted = VOTE_KIND_KEYS.flatMap((kind) => openVotes.filter((t) => t.decides === kind));
  const votingDates = sorted.some((t) => t.decides === "dates");

  return (
    <>
      {!votingDates && (
        <section className={cn(PANEL, "bg-linear-to-br from-accent to-card")}>
          <div className="text-[28px] font-semibold leading-tight tracking-tight text-foreground md:text-[34px]">{UNDATED_LABEL}</div>
          <div className="mt-1 text-sm text-secondary-foreground">
            Propongan fechas y voten entre todos; con las elegidas armamos el itinerario día por día.
          </div>
          <Button onClick={() => votes.startVote("dates")} className="mt-4 rounded-full px-5 font-semibold">
            <span aria-hidden>🗳️</span> Votar las fechas
          </Button>
        </section>
      )}
      {sorted.map((t) => (
        <VoteCard key={t.id} task={t} trip={trip} activityCount={activityCount} voting={voting} votes={votes} />
      ))}
    </>
  );
}
