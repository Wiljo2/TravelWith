import type Anthropic from "@anthropic-ai/sdk";
import {
  NEW_EVENT_FIELDS, NEW_EVENT_REQUIRED, pick, readTrip, schema, summarize, toolErrorMessage, type Input,
} from "@/server/agent/shared";
import { DomainError } from "@/server/domain/core";
import { peopleCount, taskOptionsDetail } from "@/server/domain/read";
import { runOp } from "@/server/ops";
import type { OpContext } from "@/server/ops/types";

// Decisions (task options), several activities at once, the travelers and the
// trip's name: each write is one op of the registry, like the other tools.

const MAX_EVENTS = 20;

export const TRIP_TOOLS: Anthropic.Tool[] = [
  {
    name: "get_task_options",
    description:
      "Get the candidate options of the group's decisions (tasks with options): label, note, amount, currency, splitMode and groupUSD (the option's total for the whole group). Pass taskId for one task; omit it to list every task that has options. Call this before comparing or choosing options.",
    input_schema: schema({ taskId: { type: "string", description: "Task id from get_trip_overview or get_day_detail (optional)" } }),
  },
  {
    name: "add_task_option",
    description:
      "Add a candidate option to a task (a hotel, a tour, a restaurant… the group is deciding between). amount is optional; splitMode 'group' = amount is the fixed total, 'perPerson' = amount is per traveler.",
    input_schema: schema(
      {
        taskId: { type: "string", description: "Task id from get_trip_overview or get_day_detail" },
        label: { type: "string", description: "Short name of the option" },
        note: { type: "string", description: "Link, details or price notes" },
        amount: { type: "number", description: "Cost in `currency` units. Meaning depends on splitMode." },
        currency: { type: "string", description: "USD | COP. Default USD." },
        splitMode: { type: "string", description: "group | perPerson. Default group." },
      },
      ["taskId", "label"],
    ),
  },
  {
    name: "choose_task_option",
    description:
      "Confirm the option the group chose for a task. It creates the calendar activity (if the task is scheduled on a day) and the budget expense (if the option has an amount), then deletes the task and all its options. Read get_task_options first.",
    input_schema: schema(
      {
        taskId: { type: "string" },
        optionId: { type: "string", description: "Option id from get_task_options" },
      },
      ["taskId", "optionId"],
    ),
  },
  {
    name: "create_events",
    description: `Create several calendar activities at once (1 to ${MAX_EVENTS}), e.g. to draft a whole day. Each item is like create_event. They are created in order and creation stops at the first failure: the result lists the created ones and the failed item.`,
    input_schema: schema(
      {
        events: {
          type: "array",
          maxItems: MAX_EVENTS,
          items: schema(NEW_EVENT_FIELDS, NEW_EVENT_REQUIRED),
        },
      },
      ["events"],
    ),
  },
  {
    name: "add_traveler",
    description:
      "Add a traveler by name: someone going on the trip who doesn't use the app. Travelers count in per-person budget math; members who joined the trip are already counted.",
    input_schema: schema({ name: { type: "string" } }, ["name"]),
  },
  {
    name: "remove_traveler",
    description:
      "Remove a traveler added by name (kind 'traveler' in get_trip_overview). App members can't be removed: they leave the trip themselves.",
    input_schema: schema({ travelerId: { type: "string", description: "Traveler id from get_trip_overview" } }, ["travelerId"]),
  },
  {
    name: "update_trip",
    description:
      "Rename the trip or change its destination. Only pass the fields to change. Dates can't be changed here: changing them rebuilds the itinerary, so the user does it in the app.",
    input_schema: schema({
      name: { type: "string" },
      destination: { type: "string", description: "Empty string clears it" },
    }),
  },
];

export const TRIP_TOOL_LABELS: Record<string, string> = {
  get_task_options: "Revisando las opciones",
  add_task_option: "Agregando opción",
  choose_task_option: "Eligiendo opción",
  create_events: "Creando actividades",
  add_traveler: "Agregando viajero",
  remove_traveler: "Quitando viajero",
  update_trip: "Actualizando el viaje",
};

const OP_TOOLS: Record<string, (input: Input) => { op: string; args: Input }> = {
  add_task_option: (input) => ({ op: "taskOption.create", args: pick(input, ["taskId", "label", "note", "amount", "currency", "splitMode"]) }),
  choose_task_option: (input) => ({ op: "task.chooseOption", args: pick(input, ["taskId", "optionId"]) }),
  add_traveler: (input) => ({ op: "traveler.add", args: pick(input, ["name"]) }),
  remove_traveler: (input) => ({ op: "traveler.remove", args: { id: input.travelerId } }),
  update_trip: (input) => ({ op: "trip.update", args: pick(input, ["name", "destination"]) }),
};

async function createEvents(ctx: OpContext, events: unknown) {
  if (!Array.isArray(events) || events.length === 0) throw new DomainError("events must be a non-empty array");
  if (events.length > MAX_EVENTS) throw new DomainError(`At most ${MAX_EVENTS} events per call; split them into several calls`);
  const created: { index: number; eventId: string; title: unknown }[] = [];
  for (const [index, args] of events.entries()) {
    try {
      const { row } = (await runOp("event.create", ctx, { args })).changed[0];
      created.push({ index, eventId: row.id, title: (row as { title?: unknown }).title });
    } catch (e) {
      const error = toolErrorMessage(e);
      if (error === null) throw e;
      return { created, failed: { index, error } };
    }
  }
  return { created, failed: null };
}

export function isTripTool(name: string): boolean {
  return TRIP_TOOLS.some((t) => t.name === name);
}

export async function runTripTool(ctx: OpContext, name: string, input: Input): Promise<unknown> {
  if (name === "get_task_options") {
    const { payload, members } = await readTrip(ctx.code);
    const taskId = typeof input.taskId === "string" && input.taskId ? input.taskId : undefined;
    return taskOptionsDetail(payload, peopleCount(payload, members.length), taskId);
  }
  if (name === "create_events") return createEvents(ctx, input.events);
  const { op, args } = OP_TOOLS[name](input);
  return summarize([await runOp(op, ctx, { args })]);
}
