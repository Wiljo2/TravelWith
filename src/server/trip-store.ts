import { createServerClient } from "@/lib/supabase-server";
import type { RoomPayload } from "@/hooks/useRoom";
import type { RoomMember } from "@/types";

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

// Persists the full payload, keeping the denormalized `name` column in sync.
// Returns the new updated_at so callers can chain optimistic-concurrency saves.
export async function persistRoom(code: string, payload: RoomPayload): Promise<string> {
  const supabase = createServerClient();

  const update: { payload: RoomPayload; name?: string } = { payload };
  if (payload.trip?.name) update.name = payload.trip.name;

  const { data, error } = await supabase
    .from("rooms")
    .update(update)
    .eq("code", code)
    .select("updated_at")
    .maybeSingle();

  if (error) throw new TripStoreError(error.message, 500);
  if (!data) throw new TripStoreError("Sala no encontrada", 404);
  return data.updated_at as string;
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

    const supabase = createServerClient();
    const update: { payload: RoomPayload; name?: string } = { payload: next };
    if (next.trip?.name) update.name = next.trip.name;

    const { data, error } = await supabase
      .from("rooms")
      .update(update)
      .eq("code", code)
      .eq("updated_at", updatedAt)
      .select("updated_at")
      .maybeSingle();

    if (error) throw new TripStoreError(error.message, 500);
    if (data) return next;
    // No row matched → updated_at changed under us; retry on fresh state.
  }
  throw new TripStoreError("Conflicto de concurrencia al guardar", 409);
}
