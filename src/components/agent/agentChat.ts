import type { AgentAction, AgentChatMessage, AgentDecision, AgentPending } from "@/types";

export type AgentFrame =
  | { type: "text"; delta: string }
  | { type: "tool"; name?: string; label: string }
  | { type: "error"; message: string }
  | { type: "confirm"; token: string; actions: AgentAction[] }
  | { type: "done"; usage?: unknown };

export function applyFrame(message: AgentChatMessage, frame: AgentFrame): AgentChatMessage {
  switch (frame.type) {
    case "text":
      return { ...message, content: message.content + frame.delta };
    case "tool":
      return { ...message, tools: [...(message.tools ?? []), frame.label] };
    case "error":
      return {
        ...message,
        content: message.content ? `${message.content}\n\n${frame.message}` : frame.message,
        error: true,
      };
    case "confirm":
      return { ...message, pending: { token: frame.token, actions: frame.actions, status: "pending" } };
    default:
      return message;
  }
}

export function proposalTrace(pending: AgentPending): string {
  const expired = pending.status === "expired" || pending.status === "pending";
  const parts = pending.actions.map((action) => {
    const approved = pending.decisions?.find((d) => d.id === action.id)?.approve ?? false;
    const state = expired ? "expirada" : approved ? "aprobada" : "rechazada";
    return `${action.summary} → ${state}`;
  });
  return `[Propuesta: ${parts.join("; ")}]`;
}

export function messageForHistory(message: AgentChatMessage): string {
  const text = message.content.trim();
  if (message.role !== "assistant" || !message.pending) return text;
  const trace = proposalTrace(message.pending);
  return text ? `${text}\n${trace}` : trace;
}

export function buildHistory(messages: AgentChatMessage[], newText?: string) {
  const history = messages
    .map((m) => ({ role: m.role, content: messageForHistory(m) }))
    .filter((m) => m.content);
  if (newText) history.push({ role: "user", content: newText });
  return history;
}

export function expirePending(messages: AgentChatMessage[]): AgentChatMessage[] {
  return messages.map((m) =>
    m.pending?.status === "pending" ? { ...m, pending: { ...m.pending, status: "expired" as const } } : m,
  );
}

export function resolvePending(pending: AgentPending, decisions: AgentDecision[]): AgentPending {
  const anyApproved = decisions.some((d) => d.approve);
  return { ...pending, status: anyApproved ? "approved" : "rejected", decisions };
}
