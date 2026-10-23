import { describe, expect, it } from "vitest";
import {
  alreadyProposed, chosenOption, closedVoteChanges, dateOptionLabel, hasVoted, isVote, leader, namesText, openVote, optionDayCount,
  ranked, totalVotes, voteCount, voterNames, withVote, type VoteTask,
} from "@/utils/votes";
import { headerToTrip } from "@/utils/tripRows";
import type { RoomMember, Task, TaskOption } from "@/types";

const member = (userId: string, name: string): RoomMember => ({ userId, name, joinedAt: "2026-10-01T00:00:00Z" });
const members = [member("u1", "Ana Pérez"), member("u2", "luis@mail.com"), member("u3", "Sofía")];
const option = (id: string, votes?: string[]): TaskOption => ({ id, label: id, votes });

describe("votes", () => {
  it("counts only voters still in the roster, or everyone without a roster", () => {
    const o = option("a", ["u1", "gone", "u2"]);
    expect(voteCount(o, members.map((m) => m.userId))).toBe(2);
    expect(voteCount(o)).toBe(3);
    expect(voteCount(option("b"))).toBe(0);
  });

  it("toggles one voter at most once", () => {
    const o = option("a", ["u2"]);
    expect(withVote(o, "u1", true).votes).toEqual(["u2", "u1"]);
    expect(withVote(withVote(o, "u1", true), "u1", true).votes).toEqual(["u2", "u1"]);
    expect(withVote(o, "u2", false).votes).toEqual([]);
    expect(withVote(option("b"), "u1", false).votes).toEqual([]);
    expect(hasVoted(o, "u2")).toBe(true);
    expect(hasVoted(option("b"), "u2")).toBe(false);
  });

  it("ranks options and names a leader only without a tie", () => {
    const options = [option("a", ["u1"]), option("b", ["u1", "u2"]), option("c")];
    expect(ranked(options).map((r) => [r.option.id, r.votes])).toEqual([["b", 2], ["a", 1], ["c", 0]]);
    expect(leader(options)?.id).toBe("b");
    expect(leader([option("a", ["u1"]), option("b", ["u2"])])).toBeNull();
    expect(leader([option("a"), option("b")])).toBeNull();
    expect(leader([])).toBeNull();
    expect(totalVotes(options)).toBe(3);
  });

  it("names voters with me first and first names", () => {
    expect(voterNames(option("a", ["u2", "u1", "gone"]), members, "u1")).toEqual(["Tú", "luis"]);
    expect(voterNames(option("a", ["u3"]), members, "u1")).toEqual(["Sofía"]);
    expect(voterNames(option("a", ["local"]), [], "local")).toEqual(["Tú"]);
    expect(voterNames(option("a", ["x"]), [], "local")).toEqual(["Alguien"]);
  });

  it("joins names in Spanish", () => {
    expect(namesText([])).toBe("");
    expect(namesText(["Tú"])).toBe("Tú");
    expect(namesText(["Tú", "Ana"])).toBe("Tú y Ana");
    expect(namesText(["Tú", "Ana", "Luis"])).toBe("Tú, Ana y Luis");
    expect(namesText(["Tú", "Ana", "Luis", "Sofía", "Leo"])).toBe("Tú, Ana y 3 más");
  });
});

describe("date and destination votes", () => {
  const dates: VoteTask = { id: "k1", title: "¿Cuándo viajamos?", done: false, decides: "dates", options: [
    { id: "a", label: "Nov 26 – 28, 2026", startDate: "2026-11-26", endDate: "2026-11-28" },
    { id: "b", label: "Dic 3 – 6, 2026", startDate: "2026-12-03", endDate: "2026-12-06" },
  ] };
  const place: VoteTask = { id: "k2", title: "¿A dónde vamos?", done: false, decides: "destination", options: [{ id: "c", label: " Cartagena " }] };
  const trip = { name: "Caribe", destination: "Bogotá", startDate: "2026-10-01", endDate: "2026-10-03" };

  it("tells votes from tasks and finds the open one of a kind", () => {
    const regular: Task = { id: "k3", title: "Hotel", done: false };
    expect(isVote(dates)).toBe(true);
    expect(isVote(regular)).toBe(false);
    expect(isVote({ ...regular, decides: "budget" as never })).toBe(false);
    expect(openVote([regular, dates, place], "destination")?.id).toBe("k2");
    expect(openVote([{ ...dates, done: true }], "dates")).toBeUndefined();
  });

  it("labels and measures date options", () => {
    expect(dateOptionLabel("2026-11-26", "2026-12-04")).toBe("Nov 26 – Dic 4, 2026");
    expect(optionDayCount(dates.options![1])).toBe(4);
    expect(optionDayCount({})).toBeNull();
    expect(optionDayCount({ startDate: "2026-12-04", endDate: "2026-11-26" })).toBeNull();
  });

  it("spots repeated proposals", () => {
    expect(alreadyProposed(dates.options!, { label: "x", startDate: "2026-11-26", endDate: "2026-11-28" })).toBe(true);
    expect(alreadyProposed(dates.options!, { label: "x", startDate: "2026-11-26", endDate: "2026-11-29" })).toBe(false);
    expect(alreadyProposed(place.options!, { label: "cartagena" })).toBe(true);
    expect(alreadyProposed(place.options!, { label: "Santa Marta" })).toBe(false);
  });

  it("closing changes the header, and for dates rebuilds the days", () => {
    const byDates = closedVoteChanges(dates, dates.options![1], trip)!;
    expect(headerToTrip(byDates.header, trip)).toEqual({ ...trip, startDate: "2026-12-03", endDate: "2026-12-06" });
    expect(byDates.days?.map((d) => d.id)).toEqual(["d0", "d1", "d2", "d3"]);
    const byPlace = closedVoteChanges(place, place.options![0], trip)!;
    expect(headerToTrip(byPlace.header, trip)).toEqual({ ...trip, destination: "Cartagena" });
    expect(byPlace.days).toBeNull();
    expect(headerToTrip(closedVoteChanges(dates, dates.options![0], { name: "Caribe" })!.header, { name: "Caribe" }))
      .toEqual({ name: "Caribe", startDate: "2026-11-26", endDate: "2026-11-28" });
    expect(closedVoteChanges(dates, { id: "z", label: "Sin fechas" }, trip)).toBeNull();
  });

  it("finds what a closed vote chose from the trip header", () => {
    const closed = { ...dates, done: true };
    expect(chosenOption(closed, { ...trip, startDate: "2026-12-03", endDate: "2026-12-06" })?.id).toBe("b");
    expect(chosenOption(closed, trip)).toBeUndefined();
    expect(chosenOption(dates, { ...trip, startDate: "2026-12-03", endDate: "2026-12-06" })).toBeUndefined();
    expect(chosenOption({ ...place, done: true }, { ...trip, destination: "cartagena" })?.id).toBe("c");
  });
});
