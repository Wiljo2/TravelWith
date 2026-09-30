import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock, type QueryHandler } from "@/test/supabaseMock";
import { tripHeaderPatch, newTravelerRow } from "@/server/domain/tripRows";
import type { RoomHeaderRow } from "@/server/repo/trip";
import type { OpContext } from "@/server/ops/types";

let handler: QueryHandler = () => undefined;
let mock = createSupabaseMock((q) => handler(q));

vi.mock("@/lib/supabase-server", () => ({ createServerClient: () => mock.client }));

const { OPS, runOp } = await import("@/server/ops");

const ctx: OpContext = { code: "ABCD1234", userId: "u1", role: "member" };
const header: RoomHeaderRow = {
  code: "ABCD1234", name: "Demo", destination: null, start_date: "2026-10-01", end_date: "2026-10-05", exchange_rate: 4000,
};

beforeEach(() => {
  mock = createSupabaseMock((q) => handler(q));
});

describe("tripHeaderPatch", () => {
  it("validates dates against the stored ones", () => {
    expect(tripHeaderPatch(header, { endDate: "2026-10-08" })).toEqual({ end_date: "2026-10-08" });
    expect(() => tripHeaderPatch(header, { endDate: "2026-09-30" })).toThrow(/on or after/);
    expect(() => tripHeaderPatch(header, { startDate: "2026-13-01" })).toThrow(/valid dates/);
    expect(() => tripHeaderPatch(header, { endDate: "2027-01-01" })).toThrow(/at most 60 days/);
  });

  it("trims names and clears the destination with null or empty", () => {
    expect(tripHeaderPatch(header, { name: " Caribe ", destination: "" })).toEqual({ name: "Caribe", destination: null });
    expect(tripHeaderPatch(header, { destination: null })).toEqual({ destination: null });
    expect(() => tripHeaderPatch(header, { name: " " })).toThrow(/name cannot be empty/);
    expect(() => tripHeaderPatch(header, {})).toThrow(/nothing to update/);
  });

  it("newTravelerRow keeps UUID ids from the client", () => {
    const id = "3f2b8c1e-8a4d-4c55-9a0e-1b2c3d4e5f60";
    expect(newTravelerRow({ id, name: " Ana " }, 2)).toEqual({ id, name: "Ana", position: 2 });
    expect(() => newTravelerRow({ name: "" }, 0)).toThrow(/name is required/);
  });
});

describe("trip ops", () => {
  it("trip.update writes the header and returns it", async () => {
    handler = (q) => (q.op === "update" ? { data: { ...header, name: "Nuevo" } } : { data: header });
    const result = await runOp("trip.update", ctx, { args: { name: "Nuevo" } });
    expect(mock.log.find((q) => q.op === "update")).toMatchObject({ table: "rooms", values: { name: "Nuevo" } });
    expect(result.trip?.name).toBe("Nuevo");
  });

  it("traveler.add respects the limit and records the user", async () => {
    handler = (q) => (q.op === "select" ? { data: [{ position: 0 }] } : { data: { ...(q.values as object), version: 1 } });
    const result = await runOp("traveler.add", ctx, { args: { name: "Luis" } });
    expect(result.changed[0].row).toMatchObject({ name: "Luis", position: 1, updated_by: "u1" });
    handler = () => ({ data: Array.from({ length: 50 }, (_, i) => ({ position: i })) });
    await expect(runOp("traveler.add", ctx, { args: { name: "X" } })).rejects.toThrow(/50 travelers/);
  });
});

describe("op registry", () => {
  it("covers every op in the plan", () => {
    const planned = [
      "event.create", "event.update", "event.move", "event.delete",
      "day.swap", "day.update", "itinerary.reset",
      "daySpan.create", "daySpan.update", "daySpan.delete", "tripSpan.create", "tripSpan.update", "tripSpan.delete",
      "expense.create", "expense.update", "expense.delete", "trip.setExchangeRate",
      "task.create", "task.update", "task.toggle", "task.delete", "task.chooseOption",
      "taskOption.create", "taskOption.update", "taskOption.delete",
      "traveler.add", "traveler.remove", "trip.update",
    ];
    expect(Object.keys(OPS).sort()).toEqual([...planned].sort());
  });

  it("only itinerary.reset is owner-only", () => {
    expect(Object.entries(OPS).filter(([, op]) => op.minRole === "owner").map(([name]) => name)).toEqual(["itinerary.reset"]);
  });
});
