import { LIMITS } from "@/constants/limits";
import { DomainError, argId } from "@/server/domain/core";
import { checkDayRange, exchangeRateArg, expensePatch, mergedExpense, newExpenseRow } from "@/server/domain/expenseRows";
import { daysRepo } from "@/server/repo/days";
import { RowNotFoundError } from "@/server/repo/errors";
import { expensesRepo } from "@/server/repo/expenses";
import { updateTripHeader } from "@/server/repo/trip";
import { requireEventRows } from "@/server/ops/shared";
import type { OpDefinition } from "@/server/ops/types";

// Referenced days must exist and form a forward range; the linked event must exist.
async function checkRefs(
  code: string,
  row: { linked_event_id?: string | null; start_day_id?: string | null; end_day_id?: string | null },
) {
  const start = row.start_day_id ?? null;
  const end = row.end_day_id ?? null;
  await requireEventRows(code, [row.linked_event_id]);
  if (!start && !end) return;
  const positions = new Map((await daysRepo.list(code)).map((d) => [d.id, d.position]));
  for (const id of [start, end]) {
    if (id && !positions.has(id)) throw new DomainError(`Day "${id}" not found`);
  }
  checkDayRange(positions, start, end);
}

export const EXPENSE_OPS: Record<string, OpDefinition> = {
  "expense.create": {
    async run(ctx, { args }) {
      const existing = await expensesRepo.list(ctx.code);
      if (existing.length >= LIMITS.extras) throw new DomainError(`The trip already has ${LIMITS.extras} expenses`);
      const position = existing.length ? Math.max(...existing.map((x) => x.position)) + 1 : 0;
      const newRow = newExpenseRow(args, position);
      await checkRefs(ctx.code, newRow);
      const row = await expensesRepo.insert(ctx.code, newRow, ctx.userId);
      return { changed: [{ table: "trip_expenses", row }], deleted: [] };
    },
  },

  "expense.update": {
    async run(ctx, { args, expectedVersion }) {
      const id = argId(args);
      const patch = expensePatch(args);
      const current = await expensesRepo.get(ctx.code, id);
      if (!current) throw new RowNotFoundError("trip_expenses", id);
      await checkRefs(ctx.code, mergedExpense(current, patch));
      const row = await expensesRepo.update(ctx.code, id, patch, expectedVersion, ctx.userId);
      return { changed: [{ table: "trip_expenses", row }], deleted: [] };
    },
  },

  "expense.delete": {
    async run(ctx, { args, expectedVersion }) {
      const id = argId(args);
      await expensesRepo.remove(ctx.code, id, expectedVersion, ctx.userId);
      return { changed: [], deleted: [{ table: "trip_expenses", id }] };
    },
  },

  "trip.setExchangeRate": {
    async run(ctx, { args }) {
      const trip = await updateTripHeader(ctx.code, { exchange_rate: exchangeRateArg(args) });
      return { changed: [], deleted: [], trip };
    },
  },
};
