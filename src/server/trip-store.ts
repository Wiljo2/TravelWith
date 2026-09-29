import { createServerClient } from "@/lib/supabase-server";
import type { RoomPayload, RoomMember } from "@/types";

export interface LoadedRoom {
  payload: RoomPayload;
  members: RoomMember[];
  updatedAt: string;
}

export class TripStoreError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export async function loadRoom(code: string): Promise<LoadedRoom> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("rooms")
    .select("payload, members, updated_at")
    .eq("code", code)
    .maybeSingle();

  if (error) throw new TripStoreError(error.message, 500);
  if (!data) throw new TripStoreError("Sala no encontrada", 404);
  return {
    payload: data.payload as RoomPayload,
    members: (data.members ?? []) as RoomMember[],
    updatedAt: data.updated_at as string,
  };
}

// A save based on a stale version; carries the current state so the client can
// adopt it instead of overwriting another member's changes.
export class TripConflictError extends TripStoreError {
  constructor(public current: LoadedRoom) {
    super("Conflicto de versión", 409);
  }
}

// Compare-and-swap on updated_at (compared in SQL, so any timestamp format the
// client echoes back works). Keeps the denormalized `name` column in sync.
// Returns the new updated_at, or null when the stored version differs.
async function writeIfUnchanged(code: string, payload: RoomPayload, expectedUpdatedAt: string): Promise<string | null> {
  const update: { payload: RoomPayload; name?: string } = { payload };
  if (payload.trip?.name) update.name = payload.trip.name;

  const { data, error } = await createServerClient()
    .from("rooms")
    .update(update)
    .eq("code", code)
    .eq("updated_at", expectedUpdatedAt)
    .select("updated_at")
    .maybeSingle();

  if (error) throw new TripStoreError(error.message, 500);
  return data ? (data.updated_at as string) : null;
}

// Persists a full payload built on version `expectedUpdatedAt`. Atomic: if any
// other write landed in between, nothing is written and TripConflictError
// reports the current state.
export async function persistRoom(code: string, payload: RoomPayload, expectedUpdatedAt: string): Promise<string> {
  const updatedAt = await writeIfUnchanged(code, payload, expectedUpdatedAt);
  if (updatedAt) return updatedAt;
  throw new TripConflictError(await loadRoom(code));
}

// Read-modify-write with one retry on concurrent modification: the mutation is
// re-applied on fresh state, so a save that raced a member's autosave never
// clobbers their changes.
export async function mutateRoom(
  code: string,
  mutate: (payload: RoomPayload) => RoomPayload,
): Promise<RoomPayload> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const { payload, updatedAt } = await loadRoom(code);
    const next = mutate(payload);
    if (await writeIfUnchanged(code, next, updatedAt)) return next;
    // No row matched → updated_at changed under us; retry on fresh state.
  }
  throw new TripStoreError("Conflicto de concurrencia al guardar", 409);
}
