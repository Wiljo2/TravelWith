import { describe, expect, it } from "vitest";
import { hasVoted, leader, namesText, ranked, totalVotes, voteCount, voterNames, withVote } from "@/utils/votes";
import type { RoomMember, TaskOption } from "@/types";

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
