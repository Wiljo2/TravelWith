import Anthropic from "@anthropic-ai/sdk";
import { TripStoreError } from "@/server/trip-store";
import { requireMember } from "@/server/auth";
import { HttpError, errorResponse, roomCodeParam } from "@/server/http";
import { LIMITS } from "@/constants/limits";
import { AGENT_TOOLS, TOOL_LABELS, executeTool } from "@/server/agent/tools";
import { SYSTEM_PROMPT } from "@/server/agent/prompt";
import { addUsage, dailyTokenLimit, recordUsage, tokensUsedToday, type Usage } from "@/server/agent/usage";

const AGENT_MODEL = process.env.AGENT_MODEL ?? "claude-sonnet-5";
const MAX_ITERATIONS = 15;
const MAX_HISTORY_MESSAGES = 30;
const BODY_ERROR = "Body inválido: se espera { messages: [{role, content}] }";

interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

type Params = Promise<{ code: string }>;

// POST /api/rooms/[code]/agent — runs the agentic loop and streams SSE frames:
// {type:"text",delta} | {type:"tool",name,label} | {type:"done",usage} | {type:"error",message}
export async function POST(req: Request, { params }: { params: Params }) {
  let code: string;
  let userId: string;
  try {
    code = roomCodeParam((await params).code);
    // Beta rule: only the trip owner can run the (paid) assistant.
    ({ user: { id: userId } } = await requireMember(req, code, "owner"));
    if ((await tokensUsedToday(userId)) >= dailyTokenLimit()) {
      throw new HttpError(429, "Alcanzaste el límite diario del asistente. Vuelve a intentarlo mañana.");
    }
  } catch (e) {
    return errorResponse(e, "POST /api/rooms/[code]/agent");
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return jsonError(
      "El asistente no está configurado: falta ANTHROPIC_API_KEY en el servidor.",
      503,
    );
  }

  let turns: ChatTurn[];
  try {
    const body = await req.json().catch(() => {
      throw new HttpError(400, BODY_ERROR);
    });
    turns = validateTurns(body?.messages);
  } catch (e) {
    return errorResponse(e, "POST /api/rooms/[code]/agent");
  }
  if (!turns.length || turns[turns.length - 1].role !== "user") {
    return jsonError("El último mensaje debe ser del usuario", 400);
  }

  const client = new Anthropic();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (frame: Record<string, unknown>) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(frame)}\n\n`));
        } catch {
          // Client disconnected — the loop checks req.signal and stops.
        }
      };

      const messages: Anthropic.MessageParam[] = turns.map((t) => ({
        role: t.role,
        content: t.content,
      }));

      const usage: Usage = { input: 0, output: 0 };

      try {
        for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
          if (req.signal.aborted) break;

          // The request signal aborts the model call when the user disconnects,
          // so tokens stop being generated (and billed).
          const msgStream = client.messages.stream(
            {
              model: AGENT_MODEL,
              max_tokens: 8192,
              thinking: { type: "adaptive" },
              system: [
                { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
              ],
              tools: AGENT_TOOLS,
              messages,
            },
            { signal: req.signal },
          );

          msgStream.on("text", (delta) => send({ type: "text", delta }));

          const message = await msgStream.finalMessage();
          addUsage(usage, message.usage);

          if (message.stop_reason === "pause_turn") {
            messages.push({ role: "assistant", content: message.content });
            continue;
          }

          if (message.stop_reason !== "tool_use") break;

          const toolUses = message.content.filter(
            (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
          );
          messages.push({ role: "assistant", content: message.content });

          const results: Anthropic.ToolResultBlockParam[] = [];
          for (const tool of toolUses) {
            send({ type: "tool", name: tool.name, label: TOOL_LABELS[tool.name] ?? tool.name });
            const outcome = await executeTool(code, tool.name, tool.input as Record<string, unknown>);
            results.push({
              type: "tool_result",
              tool_use_id: tool.id,
              content: outcome.content,
              is_error: outcome.isError || undefined,
            });
          }
          // All tool results for this turn go back in ONE user message.
          messages.push({ role: "user", content: results });

          if (iteration === MAX_ITERATIONS - 1) {
            send({
              type: "text",
              delta: "\n\nHe alcanzado el límite de pasos para esta petición. Dime si continúo.",
            });
          }
        }

        send({ type: "done", usage: { input_tokens: usage.input, output_tokens: usage.output } });
      } catch (e) {
        if (!req.signal.aborted) send({ type: "error", message: friendlyError(e) });
      } finally {
        await recordUsage(userId, code, usage);
        try {
          controller.close();
        } catch {
          // already closed
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

// Bounds the input cost of every model call: user messages over the limit are
// rejected, earlier assistant replies are truncated (they are only context),
// and the oldest turns are dropped until the whole history fits.
function validateTurns(raw: unknown): ChatTurn[] {
  if (!Array.isArray(raw)) throw new HttpError(400, BODY_ERROR);
  const turns = raw.slice(-MAX_HISTORY_MESSAGES).map((m): ChatTurn => {
    if (
      typeof m !== "object" || m === null ||
      (m.role !== "user" && m.role !== "assistant") ||
      typeof m.content !== "string" || !m.content.trim()
    ) {
      throw new HttpError(400, BODY_ERROR);
    }
    if (m.role === "user" && m.content.length > LIMITS.chatMessage) {
      throw new HttpError(400, `El mensaje es demasiado largo (máximo ${LIMITS.chatMessage} caracteres)`);
    }
    return { role: m.role, content: m.content.slice(0, LIMITS.chatMessage) };
  });

  let total = turns.reduce((n, t) => n + t.content.length, 0);
  while (turns.length > 1 && (total > LIMITS.chatHistory || turns[0].role !== "user")) {
    total -= turns.shift()!.content.length;
  }
  return turns;
}

// Only messages meant for the user reach the client; provider and database
// details are logged server-side.
function friendlyError(e: unknown): string {
  if (e instanceof TripStoreError && e.status < 500) return e.message;
  if (e instanceof Anthropic.RateLimitError) {
    return "Se alcanzó el límite de peticiones a Claude. Intenta de nuevo en unos segundos.";
  }
  if (e instanceof Anthropic.APIConnectionError) {
    return "No se pudo conectar con la API de Claude. Intenta de nuevo.";
  }
  console.error("[api] POST /api/rooms/[code]/agent", e);
  if (e instanceof Anthropic.APIError) {
    return "El asistente no está disponible en este momento. Intenta más tarde.";
  }
  return "Ocurrió un error inesperado en el asistente.";
}

function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}
