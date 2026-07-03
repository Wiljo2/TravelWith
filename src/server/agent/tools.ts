import type Anthropic from "@anthropic-ai/sdk";
import type { RoomPayload } from "@/hooks/useRoom";
import { loadRoom, mutateRoom } from "@/server/trip-store";
import { DomainError } from "@/server/domain/core";
import { addEvent, updateEvent, deleteEvent } from "@/server/domain/events";
import { addTask, updateTask, deleteTask } from "@/server/domain/tasks";
import { addExtra, updateExtra, removeExtra, setExchangeRate } from "@/server/domain/extras";
import { tripOverview, dayDetail, budgetDetail } from "@/server/domain/read";
import { CATEGORIES } from "@/constants/categories";
import { TASK_CATEGORIES } from "@/constants/taskCategories";

const HOURS_DESC = "Decimal hour between 6 and 26 (e.g. 19.5 = 7:30pm, 25 = 1:00am next day)";
const EVENT_CATS = Object.keys(CATEGORIES).join(" | ");
const TASK_CATS = Object.keys(TASK_CATEGORIES).join(" | ");

function schema(properties: Record<string, unknown>, required: string[] = []) {
  return { type: "object" as const, properties, required, additionalProperties: false };
}

export const AGENT_TOOLS: Anthropic.Tool[] = [
  {
    name: "get_trip_overview",
    description:
      "Get the trip summary: name, dates, traveler count, day list with dayIds, backlog tasks and the current group total. Call this FIRST whenever you need context about the trip (day ids, what exists) before reading details or writing.",
    input_schema: schema({}),
  },
  {
    name: "get_day_detail",
    description:
      "Get every event and scheduled task of one day, with their ids, times and linked expenses. Call this before editing or deleting anything on a day, to get the exact eventId/taskId.",
    input_schema: schema(
      { dayId: { type: "string", description: "Day id from get_trip_overview (e.g. d0)" } },
      ["dayId"],
    ),
  },
  {
    name: "get_budget",
    description:
      "Get all expenses with computed group totals and per-person amounts in USD, plus the trip totals. Call this before answering money questions or editing expenses.",
    input_schema: schema({}),
  },
  {
    name: "create_event",
    description: "Create a calendar activity on a day. Call when the user asks to add/schedule an activity.",
    input_schema: schema(
      {
        dayId: { type: "string", description: "Target day id (from get_trip_overview)" },
        title: { type: "string" },
        start: { type: "number", description: HOURS_DESC },
        end: { type: "number", description: `${HOURS_DESC}; must be greater than start` },
        cat: { type: "string", description: `Category: ${EVENT_CATS}. Default miami.` },
        note: { type: "string", description: "Optional note shown on the event" },
      },
      ["dayId", "title", "start", "end"],
    ),
  },
  {
    name: "update_event",
    description:
      "Edit an existing event: title, times, category, note, or move it to another day (pass dayId). Only pass the fields to change.",
    input_schema: schema(
      {
        eventId: { type: "string", description: "Event id from get_day_detail" },
        title: { type: "string" },
        start: { type: "number", description: HOURS_DESC },
        end: { type: "number", description: HOURS_DESC },
        cat: { type: "string", description: `Category: ${EVENT_CATS}` },
        note: { type: "string" },
        dayId: { type: "string", description: "Pass to MOVE the event to this day" },
      },
      ["eventId"],
    ),
  },
  {
    name: "delete_event",
    description:
      "Delete an event from the calendar. Linked expenses are kept but unlinked. Confirm with the user before deleting several events at once.",
    input_schema: schema({ eventId: { type: "string" } }, ["eventId"]),
  },
  {
    name: "create_task",
    description:
      "Create a task (something to decide, book, buy, confirm or pack). Omit dayId for the backlog; pass dayId+start to place it on the calendar at a specific time.",
    input_schema: schema(
      {
        title: { type: "string" },
        note: { type: "string", description: "What will be discussed / details" },
        cat: { type: "string", description: `Task category: ${TASK_CATS}. Default decidir.` },
        priority: { type: "string", description: "alta | media | baja" },
        dayId: { type: "string", description: "Day id to schedule it on the calendar (optional)" },
        start: { type: "number", description: `${HOURS_DESC} (only with dayId; default 9)` },
        end: { type: "number", description: `${HOURS_DESC} (only with dayId; default start+1)` },
      },
      ["title"],
    ),
  },
  {
    name: "update_task",
    description:
      "Edit a task: title, note, category, priority, mark done/undone, reschedule (dayId/start/end) or remove it from the calendar (unschedule: true). Only pass the fields to change.",
    input_schema: schema(
      {
        taskId: { type: "string", description: "Task id from get_trip_overview or get_day_detail" },
        title: { type: "string" },
        note: { type: "string" },
        done: { type: "boolean" },
        cat: { type: "string", description: `Task category: ${TASK_CATS}` },
        priority: { type: "string", description: "alta | media | baja" },
        dayId: { type: "string" },
        start: { type: "number", description: HOURS_DESC },
        end: { type: "number", description: HOURS_DESC },
        unschedule: { type: "boolean", description: "true = move back to backlog (clears dayId/start/end)" },
      },
      ["taskId"],
    ),
  },
  {
    name: "delete_task",
    description: "Delete a task permanently. To just complete it, use update_task with done: true instead.",
    input_schema: schema({ taskId: { type: "string" } }, ["taskId"]),
  },
  {
    name: "add_expense",
    description:
      "Add a budget expense. splitMode 'group' = amount is the fixed TOTAL split across travelers (adding people lowers the per-person share). splitMode 'perPerson' = amount is the cost PER TRAVELER (adding people raises the group total). Link to an activity with linkedEventId, or spread across days with startDayId/endDayId.",
    input_schema: schema(
      {
        label: { type: "string" },
        amount: { type: "number", description: "In `currency` units. Meaning depends on splitMode." },
        currency: { type: "string", description: "USD | COP. Default USD." },
        splitMode: { type: "string", description: "group | perPerson. Default group." },
        linkedEventId: { type: "string", description: "Attach the expense to a calendar event" },
        startDayId: { type: "string", description: "First day of a per-day range (e.g. hotel nights)" },
        endDayId: { type: "string", description: "Last day of the range; requires startDayId" },
      },
      ["label", "amount"],
    ),
  },
  {
    name: "update_expense",
    description:
      "Edit an expense: label, amount, currency, splitMode, link/unlink an event (unlinkEvent: true), or day range (clearDayRange: true). Only pass the fields to change.",
    input_schema: schema(
      {
        extraId: { type: "string", description: "Expense id from get_budget" },
        label: { type: "string" },
        amount: { type: "number" },
        currency: { type: "string", description: "USD | COP" },
        splitMode: { type: "string", description: "group | perPerson" },
        linkedEventId: { type: "string" },
        unlinkEvent: { type: "boolean" },
        startDayId: { type: "string" },
        endDayId: { type: "string" },
        clearDayRange: { type: "boolean" },
      },
      ["extraId"],
    ),
  },
  {
    name: "remove_expense",
    description: "Delete an expense from the budget. Confirm with the user before deleting several at once.",
    input_schema: schema({ extraId: { type: "string" } }, ["extraId"]),
  },
  {
    name: "set_exchange_rate",
    description: "Set the COP per USD exchange rate (TRM) used for all currency conversions.",
    input_schema: schema({ rate: { type: "number", description: "COP per 1 USD, e.g. 4000" } }, ["rate"]),
  },
];

// Spanish activity labels shown as chips in the chat UI while a tool runs.
export const TOOL_LABELS: Record<string, string> = {
  get_trip_overview: "Leyendo el plan",
  get_day_detail: "Revisando el día",
  get_budget: "Revisando el presupuesto",
  create_event: "Creando actividad",
  update_event: "Editando actividad",
  delete_event: "Eliminando actividad",
  create_task: "Creando tarea",
  update_task: "Actualizando tarea",
  delete_task: "Eliminando tarea",
  add_expense: "Agregando gasto",
  update_expense: "Editando gasto",
  remove_expense: "Eliminando gasto",
  set_exchange_rate: "Actualizando TRM",
};

export interface ToolOutcome {
  content: string;
  isError: boolean;
}

function peopleCount(payload: RoomPayload, memberCount: number): number {
  return Math.max(1, memberCount + (payload.mockPeople?.length ?? 0));
}

// Applies a mutation with the store's read-modify-write retry, capturing the
// domain result of the attempt that actually persisted.
async function withMutation<T>(
  code: string,
  fn: (payload: RoomPayload) => { payload: RoomPayload; result: T },
): Promise<T> {
  let captured: T | undefined;
  await mutateRoom(code, (payload) => {
    const { payload: next, result } = fn(payload);
    captured = result;
    return next;
  });
  return captured as T;
}

export async function executeTool(
  code: string,
  name: string,
  input: Record<string, unknown>,
): Promise<ToolOutcome> {
  try {
    const result = await runTool(code, name, input);
    return { content: JSON.stringify(result), isError: false };
  } catch (e) {
    if (e instanceof DomainError) {
      return { content: e.message, isError: true };
    }
    throw e;
  }
}

async function runTool(code: string, name: string, input: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case "get_trip_overview": {
      const { payload, members } = await loadRoom(code);
      return tripOverview(payload, peopleCount(payload, members.length));
    }
    case "get_day_detail": {
      const { payload } = await loadRoom(code);
      return dayDetail(payload, String(input.dayId));
    }
    case "get_budget": {
      const { payload, members } = await loadRoom(code);
      return budgetDetail(payload, peopleCount(payload, members.length));
    }
    case "create_event":
      return withMutation(code, (p) => {
        const { payload, event } = addEvent(p, input as never);
        return { payload, result: { ok: true, event } };
      });
    case "update_event":
      return withMutation(code, (p) => {
        const { eventId, ...patch } = input as { eventId: string } & Record<string, unknown>;
        const { payload, event } = updateEvent(p, eventId, patch as never);
        return { payload, result: { ok: true, event } };
      });
    case "delete_event":
      return withMutation(code, (p) => {
        const { payload, event } = deleteEvent(p, String(input.eventId));
        return { payload, result: { ok: true, deleted: event.title } };
      });
    case "create_task":
      return withMutation(code, (p) => {
        const { payload, task } = addTask(p, input as never);
        return { payload, result: { ok: true, task } };
      });
    case "update_task":
      return withMutation(code, (p) => {
        const { taskId, ...patch } = input as { taskId: string } & Record<string, unknown>;
        const { payload, task } = updateTask(p, taskId, patch as never);
        return { payload, result: { ok: true, task } };
      });
    case "delete_task":
      return withMutation(code, (p) => {
        const { payload, task } = deleteTask(p, String(input.taskId));
        return { payload, result: { ok: true, deleted: task.title } };
      });
    case "add_expense":
      return withMutation(code, (p) => {
        const { payload, extra } = addExtra(p, input as never);
        return { payload, result: { ok: true, expense: extra } };
      });
    case "update_expense":
      return withMutation(code, (p) => {
        const { extraId, ...patch } = input as { extraId: string } & Record<string, unknown>;
        const { payload, extra } = updateExtra(p, extraId, patch as never);
        return { payload, result: { ok: true, expense: extra } };
      });
    case "remove_expense":
      return withMutation(code, (p) => {
        const { payload, extra } = removeExtra(p, String(input.extraId));
        return { payload, result: { ok: true, deleted: extra.label } };
      });
    case "set_exchange_rate":
      return withMutation(code, (p) => {
        const { payload } = setExchangeRate(p, Number(input.rate));
        return { payload, result: { ok: true, exchangeRate: Number(input.rate) } };
      });
    default:
      throw new DomainError(`Unknown tool "${name}"`);
  }
}
