import { cn } from "@/lib/utils";
import AgentConfirmCard from "@/components/agent/AgentConfirmCard";
import type { AgentChatMessage, AgentDecision } from "@/types";

interface AgentMessageBubbleProps {
  message: AgentChatMessage;
  streaming: boolean;
  busy: boolean;
  onDecide: (decisions: AgentDecision[]) => void;
}

export default function AgentMessageBubble({ message, streaming, busy, onDecide }: AgentMessageBubbleProps) {
  if (message.role === "user") {
    return (
      <div className="ml-6 rounded-lg rounded-br-sm bg-primary/15 px-2.5 py-1.5 text-xs leading-normal text-foreground">
        {message.content}
      </div>
    );
  }
  return (
    <div className="mr-3 space-y-1.5">
      {message.tools && message.tools.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {message.tools.map((label, i) => (
            <span
              key={i}
              className="rounded-full border border-border bg-secondary px-1.5 py-px text-[9.5px] text-muted-foreground"
            >
              ⚙ {label}
            </span>
          ))}
        </div>
      )}
      {(message.content || (!streaming && !message.pending)) && (
        <div
          className={cn(
            "whitespace-pre-wrap rounded-lg rounded-bl-sm border border-border bg-secondary px-2.5 py-1.5 text-xs leading-normal",
            message.error ? "border-destructive/40 text-destructive" : "text-foreground",
          )}
        >
          {message.content}
          {streaming && <span className="animate-pulse">▍</span>}
        </div>
      )}
      {message.pending && <AgentConfirmCard pending={message.pending} streaming={busy} onDecide={onDecide} />}
      {!message.content && !message.pending && streaming && (
        <div className="px-2.5 py-1 text-[11px] text-muted-foreground">
          <span className="animate-pulse">Pensando…</span>
        </div>
      )}
    </div>
  );
}
