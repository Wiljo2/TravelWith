import { createServerClient } from "@/lib/supabase-server";
import { tableRepo } from "@/server/repo/core";
import { repoError } from "@/server/repo/errors";
import type { TripTaskOptionRow } from "@/types/database";

export const taskOptionsRepo = tableRepo("trip_task_options");

// SQL function set_task_option_vote: adds or removes one member's vote in a
// single statement, without the version guard, so concurrent voters never
// conflict. Returns the option as stored (unchanged when the vote already was
// in that state); a missing option is a 404.
export async function setOptionVote(code: string, optionId: string, on: boolean, userId: string): Promise<TripTaskOptionRow> {
  const { data, error } = await createServerClient().rpc("set_task_option_vote", {
    p_code: code,
    p_option_id: optionId,
    p_on: on,
    p_user: userId,
  });
  if (error) throw repoError(error);
  return data as TripTaskOptionRow;
}
