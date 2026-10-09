import { createServerClient } from "@/lib/supabase-server";
import type { Json } from "@/types/database";
import type { ActivityEntry, RoomMember } from "@/types";

export const ACTIVITY_PAGE = 50;

// Columns every trip row carries; a change that only touches these is not
// something a traveler did (version bumps, reordering).
const META = new Set(["room_code", "id", "version", "updated_at", "updated_by", "position"]);

interface ChangeRow {
  id: number;
  table_name: string;
  row_id: string;
  op: "INSERT" | "UPDATE" | "DELETE";
  before: Json | null;
  after: Json | null;
  user_id: string | null;
  created_at: string;
}

type Obj = Record<string, unknown>;
const obj = (v: Json | null): Obj | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : null);

// The name a traveler would recognize the item by.
export function changeLabel(row: Obj | null): string | null {
  if (!row) return null;
  const data = obj((row.data ?? null) as Json);
  const pick = row.title ?? row.label ?? row.name ?? data?.title ?? data?.key ?? data?.url;
  return typeof pick === "string" && pick.trim() ? pick.trim().slice(0, 120) : null;
}

// Fields an UPDATE changed, without the bookkeeping columns.
export function changedFields(before: Obj | null, after: Obj | null): string[] {
  if (!before || !after) return [];
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...keys].filter((k) => !META.has(k) && JSON.stringify(before[k]) !== JSON.stringify(after[k])).sort();
}

export function summarizeChange(c: ChangeRow, names: Map<string, string>): ActivityEntry | null {
  const before = obj(c.before);
  const after = obj(c.after);
  const fields = c.op === "UPDATE" ? changedFields(before, after) : [];
  if (c.op === "UPDATE" && fields.length === 0) return null;
  return {
    id: c.id,
    table: c.table_name,
    rowId: c.row_id,
    op: c.op,
    at: c.created_at,
    userName: c.user_id ? names.get(c.user_id) ?? null : null,
    label: changeLabel(after ?? before),
    fields,
  };
}

// Newest first; `before` is the id of the last entry of the previous page.
export async function listActivity(code: string, before?: number): Promise<{ entries: ActivityEntry[]; next: number | null }> {
  const db = createServerClient();
  let query = db
    .from("trip_changes")
    .select("id, table_name, row_id, op, before, after, user_id, created_at")
    .eq("room_code", code)
    .order("id", { ascending: false })
    .limit(ACTIVITY_PAGE);
  if (before !== undefined) query = query.lt("id", before);
  const [{ data, error }, room] = await Promise.all([query, db.from("rooms").select("members").eq("code", code).maybeSingle()]);
  if (error) throw error;
  if (room.error) throw room.error;

  const roster = Array.isArray(room.data?.members) ? (room.data.members as unknown as RoomMember[]) : [];
  const names = new Map(roster.map((m) => [m.userId, m.name]));
  const rows = (data ?? []) as ChangeRow[];
  return {
    entries: rows.map((r) => summarizeChange(r, names)).filter((e): e is ActivityEntry => e !== null),
    next: rows.length === ACTIVITY_PAGE ? rows[rows.length - 1].id : null,
  };
}
