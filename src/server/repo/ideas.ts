import { createServerClient } from "@/lib/supabase-server";
import { tableRepo } from "@/server/repo/core";
import { RowConflictError, RowNotFoundError, repoError } from "@/server/repo/errors";
import type { Json, TripIdeaRow } from "@/types/database";

export const ideasRepo = tableRepo("trip_ideas");

// SQL function apply_idea_video: replaces the parent's data and inserts the
// child ideas in one transaction, guarded by the parent version.
export async function applyIdeaVideo(
  code: string,
  parentId: string,
  expectedVersion: number,
  parentData: Json,
  children: { id: string; data: Json }[],
  userId: string,
): Promise<{ parent: TripIdeaRow; children: TripIdeaRow[] }> {
  const { data, error } = await createServerClient().rpc("apply_idea_video", {
    p_code: code,
    p_parent_id: parentId,
    p_expected_version: expectedVersion,
    p_parent_data: parentData,
    p_children: children,
    p_user: userId,
  });
  if (error) throw repoError(error);
  const result = data as
    | { conflict: true; current: TripIdeaRow | null }
    | { conflict?: undefined; parent: TripIdeaRow; children: TripIdeaRow[] };
  if (result.conflict) {
    if (!result.current) throw new RowNotFoundError("trip_ideas", parentId);
    throw new RowConflictError("trip_ideas", parentId, result.current);
  }
  return result;
}
