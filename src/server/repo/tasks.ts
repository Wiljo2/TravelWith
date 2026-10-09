import { createServerClient } from "@/lib/supabase-server";
import { tableRepo } from "@/server/repo/core";
import { RowConflictError, RowNotFoundError, repoError } from "@/server/repo/errors";
import type { TripEventRow, TripExpenseRow, TripTaskRow } from "@/types/database";

export const tasksRepo = tableRepo("trip_tasks");

// SQL function choose_task_option: inserts the event/expense and deletes the
// task in one transaction, guarded by the task version.
export async function chooseTaskOption(
  code: string,
  taskId: string,
  expectedVersion: number | undefined,
  event: Record<string, unknown> | null,
  expense: Record<string, unknown> | null,
  userId: string,
) {
  const { data, error } = await createServerClient().rpc("choose_task_option", {
    p_code: code,
    p_task_id: taskId,
    p_expected_version: expectedVersion ?? null,
    p_event: event,
    p_expense: expense,
    p_user: userId,
  });
  if (error) throw repoError(error);
  const result = data as
    | { conflict: true; current: TripTaskRow | null }
    | { conflict?: undefined; event: TripEventRow | null; expense: TripExpenseRow | null; task: TripTaskRow };
  if (result.conflict) {
    if (!result.current) throw new RowNotFoundError("trip_tasks", taskId);
    throw new RowConflictError("trip_tasks", taskId, result.current);
  }
  return result;
}
