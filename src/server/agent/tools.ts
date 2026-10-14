import type Anthropic from "@anthropic-ai/sdk";
import { IDEA_TOOLS, IDEA_TOOL_LABELS, isIdeaTool, runIdeaTool } from "@/server/agent/ideaTools";
import {
  EVENT_CATS, HOURS_DESC, NEW_EVENT_FIELDS, NEW_EVENT_REQUIRED, pick, readTrip, schema, summarize, toolErrorMessage, type Input,
} from "@/server/agent/shared";
import { TRIP_TOOLS, TRIP_TOOL_LABELS, isTripTool, runTripTool } from "@/server/agent/tripTools";
import { DomainError } from "@/server/domain/core";
import { tripOverview, dayDetail, budgetDetail, peopleCount } from "@/server/domain/read";
import { runOp } from "@/server/ops";
import type { OpContext, OpResult } from "@/server/ops/types";
import { TASK_CATEGORIES } from "@/constants/taskCategories";

const TASK_CATS = Object.keys(TASK_CATEGORIES).join(" | ");

export const AGENT_TOOLS: Anthropic.Tool[] = [
  {
    name: "get_trip_overview",
    description:
      "Get the trip summary: name, dates, travelers (app members and travelers added by name), day list with dayIds, cross-day ranges, backlog tasks with their option counts and the current group total. Call this FIRST whenever you need context about the trip (day ids, what exists) before reading details or writing.",
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
    input_schema: schema(NEW_EVENT_FIELDS, NEW_EVENT_REQUIRED),
  },
  {
    name: "update_event",
    description:
      "Edit an existing event: title, times, category, note, or move it to another day (pass dayId, optionally with new start/end). Only pass the fields to change. Fails if someone else changed the event at the same time: re-read it and retry.",
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
      "Delete an event from the calendar. Linked expenses are kept but unlinked; cross-day ranges that start or end at the event are removed.",
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
    description: "Delete an expense from the budget.",
    input_schema: schema({ extraId: { type: "string" } }, ["extraId"]),
  },
  {
    name: "set_exchange_rate",
    description: "Set the COP per USD exchange rate (TRM) used for all currency conversions.",
    input_schema: schema({ rate: { type: "number", description: "COP per 1 USD, e.g. 4000" } }, ["rate"]),
  },
  ...IDEA_TOOLS,
  ...TRIP_TOOLS,
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
  ...IDEA_TOOL_LABELS,
  ...TRIP_TOOL_LABELS,
};

export interface ToolOutcome {
  content: string;
  isError: boolean;
}

type OpCall = { op: string; args: Input };

function rename(input: Input, from: string): Input {
  const { [from]: id, ...rest } = input;
  return { id, ...rest };
}

// Tool inputs keep their original shape (the model and the prompt know them);
// each write tool becomes one or two ops of the registry, the same path as
// the app, so validation, limits, versions and history are shared.
const WRITE_TOOLS: Record<string, (input: Input) => OpCall[]> = {
  create_event: (input) => [{ op: "event.create", args: input }],
  update_event: (input) => {
    const args = rename(input, "eventId");
    if (args.dayId === undefined) return [{ op: "event.update", args }];
    const calls: OpCall[] = [{ op: "event.move", args: pick(args, ["id", "dayId", "start", "end"]) }];
    const rest = pick(args, ["title", "cat", "note"]);
    if (Object.keys(rest).length) calls.push({ op: "event.update", args: { id: args.id, ...rest } });
    return calls;
  },
  delete_event: (input) => [{ op: "event.delete", args: rename(input, "eventId") }],
  create_task: (input) => [{ op: "task.create", args: input }],
  update_task: (input) => [{ op: "task.update", args: rename(input, "taskId") }],
  delete_task: (input) => [{ op: "task.delete", args: rename(input, "taskId") }],
  add_expense: (input) => [{ op: "expense.create", args: input }],
  update_expense: (input) => [{ op: "expense.update", args: rename(input, "extraId") }],
  remove_expense: (input) => [{ op: "expense.delete", args: rename(input, "extraId") }],
  set_exchange_rate: (input) => [{ op: "trip.setExchangeRate", args: input }],
};

export async function executeTool(ctx: OpContext, name: string, input: Input): Promise<ToolOutcome> {
  try {
    const result = await runTool(ctx, name, input);
    return { content: JSON.stringify(result), isError: false };
  } catch (e) {
    const message = toolErrorMessage(e);
    if (message === null) throw e;
    return { content: message, isError: true };
  }
}

async function runTool(ctx: OpContext, name: string, input: Input): Promise<unknown> {
  switch (name) {
    case "get_trip_overview": {
      const { payload, members } = await readTrip(ctx.code);
      return tripOverview(payload, members);
    }
    case "get_day_detail": {
      const { payload } = await readTrip(ctx.code);
      return dayDetail(payload, String(input.dayId));
    }
    case "get_budget": {
      const { payload, members } = await readTrip(ctx.code);
      return budgetDetail(payload, peopleCount(payload, members.length));
    }
  }
  if (isIdeaTool(name)) return runIdeaTool(ctx, name, input);
  if (isTripTool(name)) return runTripTool(ctx, name, input);
  const toOps = WRITE_TOOLS[name];
  if (!toOps) throw new DomainError(`Unknown tool "${name}"`);
  const results: OpResult[] = [];
  for (const { op, args } of toOps(input)) results.push(await runOp(op, ctx, { args }));
  return summarize(results);
}
