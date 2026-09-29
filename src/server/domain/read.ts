import type { RoomPayload } from "@/types";
import { extraGroupUSD, extraPerPersonUSD } from "@/utils/currency";
import { requireDay } from "./core";

// Compact, token-efficient views of the trip for the agent. No styling fields.

export function tripOverview(payload: RoomPayload, people: number) {
  const tasks = payload.tasks ?? [];
  return {
    trip: payload.trip ?? null,
    people,
    exchangeRate: payload.exchangeRate,
    totalGroupUSD: round2(payload.extras.reduce((s, e) => s + extraGroupUSD(e, people, payload.exchangeRate), 0)),
    days: payload.days.map((d) => ({
      dayId: d.id,
      label: d.label,
      eventCount: d.events.length,
      taskCount: tasks.filter((t) => t.dayId === d.id).length,
    })),
    backlogTasks: tasks
      .filter((t) => !t.dayId)
      .map((t) => ({ taskId: t.id, title: t.title, done: t.done, cat: t.cat, priority: t.priority })),
    expenseCount: payload.extras.length,
  };
}

export function dayDetail(payload: RoomPayload, dayId: string) {
  const day = requireDay(payload, dayId);
  const tasks = (payload.tasks ?? []).filter((t) => t.dayId === dayId);
  return {
    dayId: day.id,
    label: day.label,
    events: day.events
      .slice()
      .sort((a, b) => a.start - b.start)
      .map((e) => ({
        eventId: e.id,
        title: e.title,
        start: e.start,
        end: e.end,
        cat: e.cat,
        note: e.note || undefined,
        linkedExpenseIds: payload.extras.filter((x) => x.linkedEventId === e.id).map((x) => x.id),
      })),
    scheduledTasks: tasks.map((t) => ({
      taskId: t.id,
      title: t.title,
      done: t.done,
      start: t.start,
      end: t.end,
      cat: t.cat,
      priority: t.priority,
      note: t.note || undefined,
    })),
  };
}

export function budgetDetail(payload: RoomPayload, people: number) {
  const rate = payload.exchangeRate;
  return {
    people,
    exchangeRate: rate,
    expenses: payload.extras.map((x) => ({
      extraId: x.id,
      label: x.label,
      amount: x.amount,
      currency: x.currency ?? "USD",
      splitMode: x.splitMode ?? "group",
      groupTotalUSD: round2(extraGroupUSD(x, people, rate)),
      perPersonUSD: round2(extraPerPersonUSD(x, people, rate)),
      linkedEventId: x.linkedEventId,
      startDayId: x.startDayId,
      endDayId: x.endDayId,
    })),
    totalGroupUSD: round2(payload.extras.reduce((s, e) => s + extraGroupUSD(e, people, rate), 0)),
    totalPerPersonUSD: round2(
      payload.extras.reduce((s, e) => s + extraGroupUSD(e, people, rate), 0) / Math.max(1, people),
    ),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
