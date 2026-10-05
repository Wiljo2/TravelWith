import { describe, it, expect } from "vitest";
import { ideaLinks } from "./ideaPlan";
import type { Day, Idea, IdeaLink } from "@/types";

const days: Day[] = [
  { id: "d0", label: "Jue · Nov 26", sub: "", flexible: false, events: [{ id: "e1", start: 14, end: 15, title: "Recoger carro", cat: "logist", note: "" }] },
  { id: "d1", label: "Vie · Nov 27", sub: "", flexible: false, events: [{ id: "e2", start: 10, end: 12, title: "Outlets", cat: "miami", note: "" }] },
];
const idea = (id: string, moment?: Idea["moment"]): Idea => ({ id, url: `https://x/${id}`, platform: "tiktok", createdAt: "2026-10-01", moment });
const claude: IdeaLink = { ideaId: "a", dayId: "d0", eventId: "e1", reason: "peajes", source: "claude" };
const rule: IdeaLink = { ideaId: "a", dayId: "d1", source: "rules" };
const plan = { links: [claude], at: "2026-10-04", ideaIds: ["a"] };

describe("ideaLinks", () => {
  it("uses Claude's analysis for analyzed ideas and the rules for the rest", () => {
    expect(ideaLinks([idea("a")], days, [rule], plan)).toEqual([claude]);
    expect(ideaLinks([idea("a")], days, [rule], {})).toEqual([rule]);
  });

  it("a moment set by hand wins over the analysis", () => {
    expect(ideaLinks([idea("a", { dayId: "d1", eventId: "e2" })], days, [rule], plan))
      .toEqual([{ ideaId: "a", dayId: "d1", eventId: "e2", source: "manual" }]);
    expect(ideaLinks([idea("a", { dayId: "d1" })], days, [rule], plan))
      .toEqual([{ ideaId: "a", dayId: "d1", source: "manual" }]);
    expect(ideaLinks([idea("a", { before: true })], days, [rule], plan))
      .toEqual([{ ideaId: "a", dayId: "", before: true, source: "manual" }]);
  });

  it("an empty moment means no moment in the plan", () => {
    expect(ideaLinks([idea("a", {})], days, [rule], plan)).toEqual([]);
  });

  it("falls back when the chosen day or activity left the plan", () => {
    expect(ideaLinks([idea("a", { dayId: "d1", eventId: "gone" })], days, [], plan))
      .toEqual([{ ideaId: "a", dayId: "d1", source: "manual" }]);
    expect(ideaLinks([idea("a", { dayId: "gone" })], days, [rule], plan)).toEqual([claude]);
  });
});
