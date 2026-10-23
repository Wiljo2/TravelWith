import { createServerClient } from "@/lib/supabase-server";
import { tableRepo } from "@/server/repo/core";
import type { ResetDay } from "@/server/repo/days";
import { RowConflictError, RowNotFoundError, repoError } from "@/server/repo/errors";
import type { RoomHeaderRow } from "@/server/repo/trip";
import type { TripDayRow, TripEventRow, TripExpenseRow, TripTaskRow } from "@/types/database";

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

// SQL function close_task_vote: sets the trip dates (rebuilding the days from
// `days`) or the destination, and marks the vote done, in one transaction
// guarded by the task version. `replace` allows wiping the itinerary's
// activities; without it a trip with activities is refused (400).
export async function closeTaskVote(
  code: string,
  taskId: string,
  optionId: string,
  expectedVersion: number | undefined,
  days: ResetDay[] | null,
  replace: boolean,
  userId: string,
) {
  const { data, error } = await createServerClient().rpc("close_task_vote", {
    p_code: code,
    p_task_id: taskId,
    p_option_id: optionId,
    p_expected_version: expectedVersion ?? null,
    p_days: days,
    p_replace: replace,
    p_user: userId,
  });
  if (error) throw repoError(error);
  const result = data as
    | { conflict: true; current: TripTaskRow | null }
    | { conflict?: undefined; task: TripTaskRow; days: TripDayRow[] | null; trip: RoomHeaderRow };
  if (result.conflict) {
    if (!result.current) throw new RowNotFoundError("trip_tasks", taskId);
    throw new RowConflictError("trip_tasks", taskId, result.current);
  }
  return result;
}
