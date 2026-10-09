import type Anthropic from "@anthropic-ai/sdk";
import type { OpContext } from "@/server/ops/types";
import { getTrip } from "@/server/repo/trip";
import { AGENT_TOOLS, TOOL_LABELS, executeTool } from "@/server/agent/tools";
import { SYSTEM_PROMPT } from "@/server/agent/prompt";
import { addUsage, type Usage } from "@/server/agent/usage";
import { proposedActions, toolKind } from "@/server/agent/actions";
import { signPending, type PendingState } from "@/server/agent/pending";

export const MAX_ITERATIONS = 15;
const REJECTED_TEXT = "The user rejected this action. Do not retry it; ask what they want to change instead.";
const TOO_LONG_TEXT = "La conversación es demasiado larga para proponer cambios. Intenta con un pedido más corto.";

export type Send = (frame: Record<string, unknown>) => void;

export interface Decision {
  id: string;
  approve: boolean;
}

interface LoopParams {
  client: Anthropic;
  model: string;
  messages: Anthropic.MessageParam[];
  ctx: OpContext;
  send: Send;
  signal: AbortSignal;
  usage: Usage;
}

async function runTool(ctx: OpContext, send: Send, tool: { id: string; name: string; input: unknown }) {
  send({ type: "tool", name: tool.name, label: TOOL_LABELS[tool.name] ?? tool.name });
  const outcome = await executeTool(ctx, tool.name, tool.input as Record<string, unknown>);
  return {
    type: "tool_result" as const,
    tool_use_id: tool.id,
    content: outcome.content,
    is_error: outcome.isError || undefined,
  };
}

// Runs the model until it answers, hits the step limit, or proposes write or
// delete tools. In the last case nothing is executed: the proposal is sent as
// a `confirm` frame and the loop returns, waiting for a resume request.
export async function runAgentLoop({ client, model, messages, ctx, send, signal, usage }: LoopParams) {
  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    if (signal.aborted) return;

    // The request signal aborts the model call when the user disconnects,
    // so tokens stop being generated (and billed).
    const msgStream = client.messages.stream(
      {
        model,
        max_tokens: 8192,
        thinking: { type: "adaptive" },
        system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
        tools: AGENT_TOOLS,
        messages,
      },
      { signal },
    );

    msgStream.on("text", (delta) => send({ type: "text", delta }));

    const message = await msgStream.finalMessage();
    addUsage(usage, message.usage);

    if (message.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: message.content });
      continue;
    }

    if (message.stop_reason !== "tool_use") return;

    const toolUses = message.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    messages.push({ role: "assistant", content: message.content });

    const readUses = toolUses.filter((t) => toolKind(t.name) === "read");
    const writeUses = toolUses.filter((t) => toolKind(t.name) !== "read");

    const reads: Anthropic.ToolResultBlockParam[] = [];
    for (const tool of readUses) reads.push(await runTool(ctx, send, tool));

    if (!writeUses.length) {
      // All tool results for this turn go back in ONE user message.
      messages.push({ role: "user", content: reads });
      if (iteration === MAX_ITERATIONS - 1) {
        send({
          type: "text",
          delta: "\n\nHe alcanzado el límite de pasos para esta petición. Dime si continúo.",
        });
      }
      continue;
    }

    const trip = await getTrip(ctx.code).catch(() => null);
    const actions = proposedActions(trip?.payload ?? null, writeUses);
    let token: string;
    try {
      token = signPending({
        code: ctx.code,
        userId: ctx.userId,
        messages,
        reads: reads.map((r) => ({
          tool_use_id: r.tool_use_id,
          content: String(r.content),
          ...(r.is_error ? { is_error: true } : {}),
        })),
        actions,
        toolUses: writeUses.map((t) => ({ id: t.id, name: t.name, input: (t.input ?? {}) as Record<string, unknown> })),
      });
    } catch {
      send({ type: "error", message: TOO_LONG_TEXT });
      return;
    }
    send({ type: "confirm", token, actions });
    return;
  }
}

// Builds the history to continue from after the user decided on a proposal:
// approved actions run now, everything else is reported to the model as
// rejected. Every tool_use of the paused turn gets exactly one tool_result.
export async function resumeMessages(
  state: PendingState,
  decisions: Decision[],
  ctx: OpContext,
  send: Send,
): Promise<Anthropic.MessageParam[]> {
  const approved = new Set(decisions.filter((d) => d.approve === true).map((d) => d.id));
  const writes: Anthropic.ToolResultBlockParam[] = [];
  for (const tool of state.toolUses) {
    if (approved.has(tool.id)) {
      writes.push(await runTool(ctx, send, tool));
    } else {
      writes.push({ type: "tool_result", tool_use_id: tool.id, content: REJECTED_TEXT, is_error: true });
    }
  }
  const reads: Anthropic.ToolResultBlockParam[] = state.reads.map((r) => ({
    type: "tool_result",
    tool_use_id: r.tool_use_id,
    content: r.content,
    is_error: r.is_error || undefined,
  }));
  return [...(state.messages as Anthropic.MessageParam[]), { role: "user", content: [...reads, ...writes] }];
}
