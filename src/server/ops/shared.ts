import { DomainError } from "@/server/domain/core";
import { daysRepo } from "@/server/repo/days";
import { documentsRepo } from "@/server/repo/documents";
import { eventsRepo } from "@/server/repo/events";

export async function requireDayRow(code: string, dayId: string): Promise<void> {
  if (!(await daysRepo.get(code, dayId))) throw new DomainError(`Day "${dayId}" not found`);
}

export async function requireEventRows(code: string, ids: (string | null | undefined)[]): Promise<void> {
  for (const id of new Set(ids.filter((x): x is string => !!x))) {
    if (!(await eventsRepo.get(code, id))) throw new DomainError(`Event "${id}" not found`);
  }
}

export async function requireDocumentRow(code: string, id: string | null | undefined): Promise<void> {
  if (id && !(await documentsRepo.get(code, id))) throw new DomainError(`Document "${id}" not found`);
}
