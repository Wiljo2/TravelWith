import { describe, it, expect } from "vitest";
import { normalizeRoomCode, validateRoomPayload, validateTripHeader } from "./validate";

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

describe("validateTripHeader", () => {
  it("accepts a trip without dates", () => {
    expect(validateTripHeader({ name: " Viaje ", destination: " Cartagena " })).toEqual({ name: "Viaje", destination: "Cartagena" });
    expect(validateTripHeader({ name: "Viaje", startDate: null, endDate: null })).toEqual({ name: "Viaje", destination: undefined });
  });

  it("accepts both dates in order and rejects one alone", () => {
    expect(validateTripHeader({ name: "X", startDate: "2026-01-01", endDate: "2026-01-03" })).toMatchObject({ startDate: "2026-01-01", endDate: "2026-01-03" });
    expect(validateTripHeader({ name: "X", startDate: "2026-01-01" })).toBeNull();
    expect(validateTripHeader({ name: "X", endDate: "2026-01-03" })).toBeNull();
    expect(validateTripHeader({ name: "X", startDate: "2026-01-05", endDate: "2026-01-02" })).toBeNull();
    expect(validateTripHeader({ name: "X", startDate: "", endDate: "" })).toBeNull();
  });

  it("trims a named trip with ordered dates", () => {
    expect(validateTripHeader({ name: " Viaje ", startDate: "2026-01-01", endDate: "2026-01-03" })).toEqual({
      name: "Viaje",
      destination: undefined,
      startDate: "2026-01-01",
      endDate: "2026-01-03",
    });
  });

  it("requires a name within the limit", () => {
    expect(validateTripHeader({ name: " " })).toBeNull();
    expect(validateTripHeader({ name: "", startDate: "2026-01-01", endDate: "2026-01-02" })).toBeNull();
    expect(validateTripHeader({ name: "X".repeat(81), startDate: "2026-01-01", endDate: "2026-01-02" })).toBeNull();
    expect(validateTripHeader(null)).toBeNull();
  });
});

describe("validateRoomPayload", () => {
  const base = { days: [], extras: [], exchangeRate: 4000 };

  it("accepts the minimal payload and optional collections", () => {
    expect(validateRoomPayload(base)).not.toBeNull();
    expect(validateRoomPayload({ ...base, tasks: [], tripSpans: [], mockPeople: [] })).not.toBeNull();
  });

  it("accepts a trip whose dates are still to be decided", () => {
    expect(validateRoomPayload({ ...base, trip: { name: "Viaje" } })).not.toBeNull();
    expect(validateRoomPayload({ ...base, trip: { name: "Viaje", startDate: "2026-01-01" } })).toBeNull();
  });

  it("rejects wrong top-level types and non-positive rates", () => {
    expect(validateRoomPayload(null)).toBeNull();
    expect(validateRoomPayload({ ...base, days: {} })).toBeNull();
    expect(validateRoomPayload({ ...base, exchangeRate: 0 })).toBeNull();
    expect(validateRoomPayload({ ...base, tasks: "x" })).toBeNull();
  });

  it("accepts document references and rejects malformed collections", () => {
    const doc = { id: "doc1", driveFileId: "1AbC_dEf-123456789xyz", title: "Vuelo ida", kind: "flight" };
    expect(validateRoomPayload({ ...base, documents: [doc] })).not.toBeNull();
    expect(validateRoomPayload({ ...base, documents: {} })).toBeNull();
    expect(validateRoomPayload({ ...base, documents: [null] })).toBeNull();
    expect(validateRoomPayload({ ...base, documents: ["1AbC_dEf-123456789xyz"] })).toBeNull();
  });
});
