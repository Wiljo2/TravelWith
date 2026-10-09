import { createServerClient } from "@/lib/supabase-server";
import { RowConflictError, RowNotFoundError, repoError } from "@/server/repo/errors";
import type { Tables, TablesInsert, TablesUpdate, TripTable } from "@/types/database";

type ServerManaged = "room_code" | "version" | "updated_at" | "updated_by";

export type NewRow<T extends TripTable> = Omit<TablesInsert<T>, ServerManaged>;
export type RowPatch<T extends TripTable> = Omit<TablesUpdate<T>, ServerManaged | "id">;

export interface RowFilter<T extends TripTable> {
  column: keyof Tables<T> & string;
  value: string;
}

// Typed access to one trip table. Every write records the acting user;
// updates and deletes are guarded by the row version the caller last saw
// (undefined = no guard: read the current version and retry once on a race).
// The database bumps version/updated_at on every effective update
// (013_trip_row_writes.sql), so broadcasts always carry a new version.
export function tableRepo<T extends TripTable>(table: T) {
  type Row = Tables<T>;

  async function list(code: string, filter?: RowFilter<T>): Promise<Row[]> {
    let query = createServerClient().from(table).select("*").eq("room_code", code);
    if (filter) query = query.eq(filter.column as string, filter.value);
    const { data, error } = await query.order("position", { ascending: true }).order("id", { ascending: true });
    if (error) throw repoError(error);
    return (data ?? []) as Row[];
  }

  async function get(code: string, id: string): Promise<Row | null> {
    const { data, error } = await createServerClient()
      .from(table)
      .select("*")
      .eq("room_code", code)
      .eq("id", id)
      .maybeSingle();
    if (error) throw repoError(error);
    return (data ?? null) as Row | null;
  }

  async function insert(code: string, row: NewRow<T>, userId: string): Promise<Row> {
    const { data, error } = await createServerClient()
      .from(table)
      .insert({ ...row, room_code: code, updated_by: userId })
      .select("*")
      .single();
    if (error) throw repoError(error);
    return data as Row;
  }

  async function guardedUpdate(code: string, id: string, patch: RowPatch<T>, expected: number, userId: string) {
    const { data, error } = await createServerClient()
      .from(table)
      .update({ ...patch, version: expected + 1, updated_by: userId })
      .eq("room_code", code)
      .eq("id", id)
      .eq("version", expected)
      .select("*")
      .maybeSingle();
    if (error) throw repoError(error);
    return (data ?? null) as Row | null;
  }

  async function update(
    code: string,
    id: string,
    patch: RowPatch<T>,
    expectedVersion: number | undefined,
    userId: string,
  ): Promise<Row> {
    for (let attempt = 0; attempt < 2; attempt++) {
      let expected = expectedVersion;
      if (expected === undefined) {
        const current = await get(code, id);
        if (!current) throw new RowNotFoundError(table, id);
        expected = current.version;
      }
      const updated = await guardedUpdate(code, id, patch, expected, userId);
      if (updated) return updated;

      const current = await get(code, id);
      if (!current) throw new RowNotFoundError(table, id);
      if (expectedVersion !== undefined) throw new RowConflictError(table, id, current);
    }
    throw new RowConflictError(table, id, await get(code, id));
  }

  // Returns the deleted row, or null when it was already gone.
  async function remove(code: string, id: string, expectedVersion: number | undefined, userId: string): Promise<Row | null> {
    const { data, error } = await createServerClient().rpc("delete_trip_row", {
      p_table: table,
      p_code: code,
      p_id: id,
      p_expected_version: expectedVersion ?? null,
      p_user: userId,
    });
    if (error) throw repoError(error);
    const result = (data ?? {}) as { deleted?: Row | null; current?: Row | null };
    if (result.deleted) return result.deleted;
    if (result.current) throw new RowConflictError(table, id, result.current);
    return null;
  }

  // Position after the last row of the trip, or of one scope (e.g. a day).
  async function nextPosition(code: string, filter?: RowFilter<T>): Promise<number> {
    let query = createServerClient().from(table).select("position").eq("room_code", code);
    if (filter) query = query.eq(filter.column as string, filter.value);
    const { data, error } = await query.order("position", { ascending: false }).limit(1).maybeSingle();
    if (error) throw repoError(error);
    return data ? (data as { position: number }).position + 1 : 0;
  }

  return { table, list, get, insert, update, remove, nextPosition };
}

export type TableRepo<T extends TripTable> = ReturnType<typeof tableRepo<T>>;
