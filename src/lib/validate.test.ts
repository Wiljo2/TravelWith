import { describe, it, expect } from "vitest";
import { normalizeRoomCode, validateRoomPayload, validateTripInput } from "./validate";

describe("normalizeRoomCode", () => {
  it("uppercases and trims valid codes", () => {
    expect(normalizeRoomCode(" abc123 ")).toBe("ABC123");
  });

  it("rejects codes with invalid characters or length", () => {
    expect(normalizeRoomCode("ab")).toBeNull();
    expect(normalizeRoomCode("ABC-123")).toBeNull();
    expect(normalizeRoomCode("A".repeat(20))).toBeNull();
  });
});

describe("validateTripInput", () => {
  it("accepts a named trip with ordered dates", () => {
    expect(validateTripInput({ name: " Viaje ", startDate: "2026-01-01", endDate: "2026-01-03" })).toEqual({
      name: "Viaje",
      destination: undefined,
      startDate: "2026-01-01",
      endDate: "2026-01-03",
    });
  });

  it("rejects missing names, reversed ranges and long names", () => {
    expect(validateTripInput({ name: "", startDate: "2026-01-01", endDate: "2026-01-02" })).toBeNull();
    expect(validateTripInput({ name: "X", startDate: "2026-01-05", endDate: "2026-01-02" })).toBeNull();
    expect(validateTripInput({ name: "X".repeat(81), startDate: "2026-01-01", endDate: "2026-01-02" })).toBeNull();
  });
});

describe("validateRoomPayload", () => {
  const base = { days: [], extras: [], exchangeRate: 4000 };

  it("accepts the minimal payload and optional collections", () => {
    expect(validateRoomPayload(base)).not.toBeNull();
    expect(validateRoomPayload({ ...base, tasks: [], tripSpans: [], mockPeople: [] })).not.toBeNull();
  });

  it("rejects wrong top-level types and non-positive rates", () => {
    expect(validateRoomPayload(null)).toBeNull();
    expect(validateRoomPayload({ ...base, days: {} })).toBeNull();
    expect(validateRoomPayload({ ...base, exchangeRate: 0 })).toBeNull();
    expect(validateRoomPayload({ ...base, tasks: "x" })).toBeNull();
  });
});
