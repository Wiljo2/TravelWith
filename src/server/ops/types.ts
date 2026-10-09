import type { MemberRole } from "@/server/auth";
import type { RoomHeaderRow } from "@/server/repo/trip";
import type { TripTable } from "@/types/database";

export interface OpContext {
  code: string;
  userId: string;
  role: MemberRole;
}

export interface OpInput {
  args: unknown;
  // Row version the client last saw; undefined skips the conflict check.
  expectedVersion?: number;
}

export interface RowChange {
  table: TripTable;
  row: { id: string; version: number };
}

export interface RowDeletion {
  table: TripTable;
  id: string;
}

// What an op wrote, so the caller can reconcile its optimistic state. Rows
// changed by database cascades are not listed; they arrive over Broadcast.
export interface OpResult {
  changed: RowChange[];
  deleted: RowDeletion[];
  trip?: RoomHeaderRow;
}

export interface OpDefinition {
  minRole?: "owner";
  run(ctx: OpContext, input: OpInput): Promise<OpResult>;
}
