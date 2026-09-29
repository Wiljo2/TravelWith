import { describe, it, expect } from "vitest";
import { payloadIssues } from "./schemas";
import { mockRoomPayload } from "@/data/mockRoom";
import { generateDays } from "@/utils/tripDays";

const base = () => ({ days: generateDays("2026-01-01", "2026-01-03")!, extras: [], exchangeRate: 4000 });

describe("payloadIssues", () => {
  it("accepts the demo trip and a freshly generated trip", () => {
    expect(payloadIssues(mockRoomPayload)).toEqual([]);
    expect(payloadIssues(base())).toEqual([]);
  });

  it("keeps unknown future fields and accepts nulls in optional fields", () => {
    const p = { ...base(), futureField: { x: 1 }, tasks: [{ id: "t1", title: "X", done: false, dayId: null, note: null }] };
    expect(payloadIssues(p)).toEqual([]);
  });

  it("rejects wrong nested types", () => {
    const p = base();
    p.days[0].events.push({ id: "e1", start: "9" as unknown as number, end: 10, title: "X", cat: "comida", note: "" });
    expect(payloadIssues(p)[0]).toMatch(/^days\.0\.events\.0\.start/);
  });

  it("rejects oversized strings and collections", () => {
    const p = base();
    p.days[0].events.push({ id: "e1", start: 9, end: 10, title: "X", cat: "comida", note: "n".repeat(5000) });
    expect(payloadIssues(p)).not.toEqual([]);
    const many = { ...base(), extras: Array.from({ length: 501 }, (_, i) => ({ id: `x${i}`, label: "L", amount: 1 })) };
    expect(payloadIssues(many)).not.toEqual([]);
  });

  it("only allows plain colors in spans (no url())", () => {
    const span = (bg: string) => ({ ...base(), tripSpans: [{ id: "s", startEventId: "a", endEventId: "b", bg, border: "transparent" }] });
    expect(payloadIssues(span("rgba(59,130,246,.14)"))).toEqual([]);
    expect(payloadIssues(span("#FAECE7"))).toEqual([]);
    expect(payloadIssues(span("url(https://tracker.example/p.gif)"))).not.toEqual([]);
  });
});
