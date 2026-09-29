import { describe, it, expect, vi, beforeEach } from "vitest";
import type { RoomPayload } from "@/types";
import { createSupabaseMock, filterValue, type QueryHandler } from "@/test/supabaseMock";

let handler: QueryHandler = () => undefined;
let mock = createSupabaseMock((q) => handler(q));

vi.mock("@/lib/supabase-server", () => ({
  createServerClient: () => mock.client,
}));

const { mutateRoom, TripStoreError } = await import("./trip-store");

const payload = (name: string): RoomPayload => ({
  days: [],
  extras: [],
  exchangeRate: 4000,
  trip: { name, startDate: "2026-01-01", endDate: "2026-01-02" },
});

beforeEach(() => {
  mock = createSupabaseMock((q) => handler(q));
});

describe("mutateRoom", () => {
  it("writes with an updated_at guard and returns the mutated payload", async () => {
    handler = (q) => {
      if (q.op === "select") return { data: { payload: payload("A"), members: [], updated_at: "t1" } };
      if (q.op === "update") return { data: { updated_at: "t2" } };
    };
    const next = await mutateRoom("ABC123", (p) => ({ ...p, exchangeRate: 5000 }));
    expect(next.exchangeRate).toBe(5000);
    const update = mock.log.find((q) => q.op === "update")!;
    expect(filterValue(update, "updated_at")).toBe("t1");
    expect((update.values as { name?: string }).name).toBe("A");
  });

  it("re-applies the mutation on fresh state after a concurrent write", async () => {
    let reads = 0;
    let writes = 0;
    handler = (q) => {
      if (q.op === "select") {
        reads++;
        return { data: { payload: payload(reads === 1 ? "old" : "fresh"), members: [], updated_at: `t${reads}` } };
      }
      if (q.op === "update") {
        writes++;
        return { data: writes === 1 ? null : { updated_at: "t9" } };
      }
    };
    const seen: string[] = [];
    await mutateRoom("ABC123", (p) => {
      seen.push(p.trip!.name);
      return p;
    });
    expect(seen).toEqual(["old", "fresh"]);
  });

  it("gives up with 409 after a second conflict", async () => {
    handler = (q) => {
      if (q.op === "select") return { data: { payload: payload("A"), members: [], updated_at: "t1" } };
      if (q.op === "update") return { data: null };
    };
    await expect(mutateRoom("ABC123", (p) => p)).rejects.toMatchObject({ status: 409 });
    await expect(mutateRoom("ABC123", (p) => p)).rejects.toBeInstanceOf(TripStoreError);
  });

  it("returns 404 when the room does not exist", async () => {
    handler = () => ({ data: null });
    await expect(mutateRoom("NOPE12", (p) => p)).rejects.toMatchObject({ status: 404 });
  });
});
