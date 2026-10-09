import Anthropic from "@anthropic-ai/sdk";
import { requireMember, type MemberRole } from "@/server/auth";
import { assertWritable } from "@/server/maintenance";
import { HttpError, errorResponse, roomCodeParam } from "@/server/http";
import { LIMITS } from "@/constants/limits";
import { runAgentLoop, resumeMessages, type Decision, type Send } from "@/server/agent/loop";
import { verifyPending, type PendingState } from "@/server/agent/pending";
import { dailyTokenLimit, recordUsage, tokensUsedToday, type Usage } from "@/server/agent/usage";

const AGENT_MODEL = process.env.AGENT_MODEL ?? "claude-sonnet-5";
const MAX_DECISIONS = 50;
const MAX_HISTORY_MESSAGES = 30;
const BODY_ERROR = "Body inválido: se espera { messages: [{role, content}] }";
const RESUME_ERROR = "Body inválido: resume debe ser { token, decisions: [{id, approve}] }";

interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

type Params = Promise<{ code: string }>;

// POST /api/rooms/[code]/agent — runs the agentic loop and streams SSE frames:
// {type:"text",delta} | {type:"tool",name,label} | {type:"confirm",token,actions}
// | {type:"done",usage} | {type:"error",message}
// Body: { messages } starts a turn; { resume: { token, decisions } } continues a
// turn paused on a `confirm` frame. Writes only run after an approval.
export async function POST(req: Request, { params }: { params: Params }) {
  let code: string;
  let userId: string;
  let role: MemberRole;
  try {
    code = roomCodeParam((await params).code);
    assertWritable();
    // Beta rule: only the trip owner can run the (paid) assistant.
    ({ user: { id: userId }, role } = await requireMember(req, code, "owner"));
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

  let turns: ChatTurn[] = [];
  let pending: { state: PendingState; decisions: Decision[] } | null = null;
  try {
    const body = await req.json().catch(() => {
      throw new HttpError(400, BODY_ERROR);
    });
    if (body?.resume !== undefined) {
      const { token, decisions } = validateResume(body.resume);
      pending = { state: verifyPending(token, { code, userId }), decisions };
    } else {
      turns = validateTurns(body?.messages);
      if (!turns.length || turns[turns.length - 1].role !== "user") {
        throw new HttpError(400, "El último mensaje debe ser del usuario");
      }
    }
  } catch (e) {
    return errorResponse(e, "POST /api/rooms/[code]/agent");
  }

  const client = new Anthropic();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send: Send = (frame) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(frame)}\n\n`));
        } catch {
          // Client disconnected — the loop checks req.signal and stops.
        }
      };

      const ctx = { code, userId, role };
      const usage: Usage = { input: 0, output: 0 };

      try {
        const messages = pending
          ? await resumeMessages(pending.state, pending.decisions, ctx, send)
          : turns.map((t): Anthropic.MessageParam => ({ role: t.role, content: t.content }));

        await runAgentLoop({ client, model: AGENT_MODEL, messages, ctx, send, signal: req.signal, usage });

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

function validateResume(raw: unknown): { token: string; decisions: Decision[] } {
  const r = raw as { token?: unknown; decisions?: unknown } | null;
  if (
    typeof r !== "object" || r === null ||
    typeof r.token !== "string" ||
    !Array.isArray(r.decisions) || r.decisions.length > MAX_DECISIONS ||
    !r.decisions.every(
      (d) => typeof d === "object" && d !== null && typeof d.id === "string" && typeof d.approve === "boolean",
    )
  ) {
    throw new HttpError(400, RESUME_ERROR);
  }
  return {
    token: r.token,
    decisions: r.decisions.map((d: Decision) => ({ id: d.id, approve: d.approve })),
  };
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
  if (e instanceof HttpError && e.status < 500) return e.message;
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
