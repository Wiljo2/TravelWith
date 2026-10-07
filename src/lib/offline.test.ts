import { beforeEach, describe, it, expect } from "vitest";
import { lastSnapshotCode, loadRoomList, loadSnapshot, saveRoomList, saveSnapshot, updateSnapshotPayload } from "./offline";
import type { RoomPayload } from "@/hooks/useRoom";

const store = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, v); },
  removeItem: (k: string) => { store.delete(k); },
  clear: () => store.clear(),
  key: () => null,
  length: 0,
} as Storage;

const payload = (n: number) => ({ days: [{ id: `d${n}`, label: "", sub: "", flexible: false, events: [] }], extras: [], exchangeRate: 1 }) as RoomPayload;

describe("offline snapshot", () => {
  beforeEach(() => store.clear());

  it("keeps the last copy of a room and remembers it as the last one", () => {
    saveSnapshot("ABC", { payload: payload(1), members: [{ userId: "u", name: "Ana", joinedAt: "" }] });
    expect(loadSnapshot("ABC")?.payload.days[0].id).toBe("d1");
    expect(lastSnapshotCode()).toBe("ABC");
  });

  it("updates the payload after a save, keeping the members", () => {
    saveSnapshot("ABC", { payload: payload(1), members: [{ userId: "u", name: "Ana", joinedAt: "" }] });
    updateSnapshotPayload("ABC", payload(2));
    expect(loadSnapshot("ABC")?.payload.days[0].id).toBe("d2");
    expect(loadSnapshot("ABC")?.members[0].name).toBe("Ana");
  });

  it("ignores broken data", () => {
    store.set("tw:room:XYZ", "{not json");
    expect(loadSnapshot("XYZ")).toBeNull();
  });

  it("keeps the trip list per user", () => {
    saveRoomList("u1", [{ room_code: "ABC" }]);
    expect(loadRoomList("u1")).toEqual([{ room_code: "ABC" }]);
    expect(loadRoomList("u2")).toEqual([]);
  });
});
