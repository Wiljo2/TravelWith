import type { Day, RoomMember, Task, TaskDecides, TaskOption, TripInfo } from "@/types";
import { VOTE_KINDS } from "@/constants/votes";
import { fmtTripDates, generateDays } from "@/utils/tripDays";

// Approval voting on task options: each member backs as many options as they
// like. Votes of people who left the trip stop counting; with no roster (local
// mode, or before the trip loads) every vote counts.

type Voted = Pick<TaskOption, "votes">;

export type VoteTask = Task & { decides: TaskDecides };

// A date or destination vote (rows from older or newer clients may carry an unknown kind).
export function isVote(task: Task): task is VoteTask {
  return !!task.decides && Object.hasOwn(VOTE_KINDS, task.decides);
}

// The vote of that kind still waiting for the owner to close it.
export function openVote(tasks: Task[], kind: TaskDecides): VoteTask | undefined {
  return tasks.find((t): t is VoteTask => isVote(t) && t.decides === kind && !t.done);
}

// "Nov 26 – Dic 4, 2026"; the stored label of a date option.
export function dateOptionLabel(startDate: string, endDate: string): string {
  return fmtTripDates(startDate, endDate);
}

// Days in a date option, or null when it has no valid range.
export function optionDayCount(option: Pick<TaskOption, "startDate" | "endDate">): number | null {
  return option.startDate && option.endDate ? generateDays(option.startDate, option.endDate)?.length ?? null : null;
}

// The option a closed vote settled on, as the trip header shows it now.
export function chosenOption(task: VoteTask, trip: TripInfo | null): TaskOption | undefined {
  if (!task.done || !trip) return undefined;
  const options = task.options ?? [];
  if (task.decides === "dates") return options.find((o) => o.startDate === trip.startDate && o.endDate === trip.endDate);
  const destination = trip.destination?.trim().toLowerCase();
  return destination ? options.find((o) => o.label.trim().toLowerCase() === destination) : undefined;
}

// What closing a vote with `option` changes on the client: the trip header (as
// rooms stores it, for headerToTrip) and, for dates, the days rebuilt like a
// new trip's. Null when the option can't settle the vote.
export function closedVoteChanges(
  task: VoteTask,
  option: TaskOption,
  trip: TripInfo | null,
): { header: Record<string, unknown>; days: Day[] | null } | null {
  if (task.decides === "dates") {
    const days = option.startDate && option.endDate ? generateDays(option.startDate, option.endDate) : null;
    if (!days) return null;
    return { header: { destination: trip?.destination ?? null, start_date: option.startDate, end_date: option.endDate }, days };
  }
  const destination = option.label.trim();
  if (!destination) return null;
  return { header: { destination, start_date: trip?.startDate ?? null, end_date: trip?.endDate ?? null }, days: null };
}

// Whether an option with this value is already proposed (same range, or same name ignoring case).
export function alreadyProposed(options: TaskOption[], proposal: Pick<TaskOption, "label" | "startDate" | "endDate">): boolean {
  if (proposal.startDate) return options.some((o) => o.startDate === proposal.startDate && o.endDate === proposal.endDate);
  const label = proposal.label.trim().toLowerCase();
  return options.some((o) => o.label.trim().toLowerCase() === label);
}

export function countedVotes(option: Voted, memberIds: readonly string[] = []): string[] {
  const votes = option.votes ?? [];
  return memberIds.length ? votes.filter((v) => memberIds.includes(v)) : votes;
}

export function voteCount(option: Voted, memberIds?: readonly string[]): number {
  return countedVotes(option, memberIds).length;
}

export function hasVoted(option: Voted, voter: string): boolean {
  return (option.votes ?? []).includes(voter);
}

// The option after `voter` backs it (on) or withdraws, each voter at most once.
export function withVote<T extends Voted>(option: T, voter: string, on: boolean): T {
  const others = (option.votes ?? []).filter((v) => v !== voter);
  return { ...option, votes: on ? [...others, voter] : others };
}

// Options by votes, most voted first (ties keep their order).
export function ranked<T extends Voted>(options: T[], memberIds?: readonly string[]): { option: T; votes: number }[] {
  return options.map((option) => ({ option, votes: voteCount(option, memberIds) })).sort((a, b) => b.votes - a.votes);
}

// The single most voted option; null when nobody voted or the top is a tie.
export function leader<T extends Voted>(options: T[], memberIds?: readonly string[]): T | null {
  const [first, second] = ranked(options, memberIds);
  if (!first || first.votes === 0 || (second && second.votes === first.votes)) return null;
  return first.option;
}

// Total votes across a task's options.
export function totalVotes(options: Voted[], memberIds?: readonly string[]): number {
  return options.reduce((n, o) => n + voteCount(o, memberIds), 0);
}

// Who backs the option, as the trip shows them: "Tú" first, then first names.
export function voterNames(option: Voted, members: readonly RoomMember[], me: string): string[] {
  const byId = new Map(members.map((m) => [m.userId, m.name]));
  const votes = countedVotes(option, members.map((m) => m.userId));
  const others = votes.filter((v) => v !== me).map((v) => shortName(byId.get(v) ?? "Alguien"));
  return votes.includes(me) ? ["Tú", ...others] : others;
}

function shortName(name: string): string {
  return name.trim().split(/\s+/)[0].split("@")[0] || "Alguien";
}

// "Tú", "Tú y Ana", "Tú, Ana y Luis", "Tú, Ana y 3 más".
export function namesText(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length <= 3) return `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`;
  return `${names.slice(0, 2).join(", ")} y ${names.length - 2} más`;
}
