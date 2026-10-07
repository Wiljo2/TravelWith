import { describe, expect, it } from "vitest";
import { isAccessDenied, needsRefetch, parseTripMessage } from "@/utils/tripChannel";

// Payloads as recorded in the 0.1 spike (docs/plans/relational-broadcast-progress.md).
const eventRow = { id: "e1", room_code: "SPIKE01", day_id: "d0", title: "Museo del Oro", start_hour: 9, end_hour: 10, version: 2 };
const update = {
  id: "d618a4b2-c4a6-44f7-b844-55a6d7cb49ce",
  table: "trip_events",
  schema: "public",
  operation: "UPDATE",
  record: eventRow,
  old_record: { ...eventRow, title: "Museo", version: 1 },
};

describe("parseTripMessage", () => {
  it("reads inserts and updates from record", () => {
    expect(parseTripMessage(update)).toEqual({
      kind: "row", operation: "UPDATE", table: "trip_events", id: "e1", row: eventRow, version: 2,
    });
    expect(parseTripMessage({ ...update, operation: "INSERT", old_record: null })).toMatchObject({ operation: "INSERT", row: eventRow });
  });

  it("reads deletes from old_record", () => {
    expect(parseTripMessage({ ...update, operation: "DELETE", record: null, old_record: eventRow })).toEqual({
      kind: "row", operation: "DELETE", table: "trip_events", id: "e1", row: null, version: 2,
    });
  });

  it("reads the rooms header, roster and room deletion", () => {
    const record = { code: "ABCD", name: "Viaje", exchange_rate: 4200, members: [] };
    expect(parseTripMessage({ operation: "UPDATE", table: "rooms", schema: "public", record, old_record: null })).toEqual({ kind: "room", record });
    expect(parseTripMessage({ operation: "DELETE", table: "rooms", record: null, old_record: { code: "ABCD" } })).toEqual({ kind: "roomDeleted" });
  });

  it("ignores unknown tables, operations and malformed rows", () => {
    expect(parseTripMessage({ ...update, table: "trip_changes" })).toBeNull();
    expect(parseTripMessage({ ...update, operation: "TRUNCATE" })).toBeNull();
    expect(parseTripMessage({ ...update, record: { ...eventRow, version: "x" } })).toBeNull();
    expect(parseTripMessage({ ...update, record: { ...eventRow, id: 5 } })).toBeNull();
    expect(parseTripMessage({ ...update, operation: "DELETE", old_record: null })).toBeNull();
    expect(parseTripMessage(null)).toBeNull();
    expect(parseTripMessage("UPDATE")).toBeNull();
  });
});

describe("channel helpers", () => {
  it("refetches only for new days", () => {
    const day = { id: "d9", version: 1 };
    expect(needsRefetch(parseTripMessage({ operation: "INSERT", table: "trip_days", record: day })!)).toBe(true);
    expect(needsRefetch(parseTripMessage({ operation: "UPDATE", table: "trip_days", record: day })!)).toBe(false);
    expect(needsRefetch(parseTripMessage({ ...update, operation: "INSERT" })!)).toBe(false);
  });

  it("detects the policy rejection seen in the spike", () => {
    expect(isAccessDenied({ message: "Unauthorized: You do not have permissions to read from this Channel topic: trip:SPIKE01" })).toBe(true);
    expect(isAccessDenied({ message: "MissingPartition: Realtime was unable to find the expected messages partition" })).toBe(false);
    expect(isAccessDenied(undefined)).toBe(false);
  });
});
