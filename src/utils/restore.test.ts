import { describe, expect, it } from "vitest";
import { eventCreateArgs, taskCreateArgs } from "@/utils/restore";

describe("restore args", () => {
  it("rebuilds the event create args from a snapshot", () => {
    const ev = { id: "e1", start: 9, end: 10.5, title: "Museo", cat: "culture", note: "n", mapsUrl: "https://maps", version: 3 };
    expect(eventCreateArgs("d1", ev)).toEqual({ id: "e1", dayId: "d1", title: "Museo", start: 9, end: 10.5, note: "n", cat: "culture", mapsUrl: "https://maps" });
  });

  it("omits empty optional event fields", () => {
    const args = eventCreateArgs("d1", { id: "e1", start: 9, end: 10, title: "A", cat: "x", note: "" });
    expect(args).not.toHaveProperty("mapsUrl");
    expect(args).not.toHaveProperty("icon");
  });

  it("drops version, options and undefined from a task", () => {
    const task = { id: "t1", title: "Reservar", done: true, dayId: undefined, priority: "alta" as const, version: 2, options: [] };
    expect(taskCreateArgs(task)).toEqual({ id: "t1", title: "Reservar", done: true, priority: "alta" });
  });
  it("keeps the linked document when restoring an event", () => {
    const args = eventCreateArgs("d1", { id: "e1", start: 9, end: 10, title: "A", cat: "x", note: "", documentId: "doc1" });
    expect(args.documentId).toBe("doc1");
  });
});
