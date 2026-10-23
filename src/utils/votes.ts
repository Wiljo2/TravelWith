import type { RoomMember, TaskOption } from "@/types";

// Approval voting on task options: each member backs as many options as they
// like. Votes of people who left the trip stop counting; with no roster (local
// mode, or before the trip loads) every vote counts.

type Voted = Pick<TaskOption, "votes">;

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
