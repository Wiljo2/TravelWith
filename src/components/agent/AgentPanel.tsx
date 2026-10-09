"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { LIMITS } from "@/constants/limits";
import { useAgentChat } from "@/hooks/useAgentChat";
import AgentMessageBubble from "@/components/agent/AgentMessageBubble";
import type { AgentChatMessage } from "@/types";

const EXAMPLES = [
  "Agrega una cena el segundo día a las 7pm",
  "¿Cuánto llevamos por persona?",
  "Crea una tarea para reservar el hotel, prioridad alta",
];

interface AgentPanelProps {
  roomCode: string;
  accessToken: string | undefined;
  messages: AgentChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<AgentChatMessage[]>>;
  className?: string;
  // Inside a titled container (the phone sheet): header only shows the stop button.
  embedded?: boolean;
}

export default function AgentPanel({ roomCode, accessToken, messages, setMessages, className, embedded }: AgentPanelProps) {
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const { streaming, send, decide, stop } = useAgentChat({ roomCode, accessToken, messages, setMessages });

  const isLocal = roomCode === "LOCAL";

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, streaming]);

  async function sendMessage(text: string) {
    if (!text.trim() || streaming || isLocal) return;
    setDraft("");
    await send(text);
  }

  return (
    <div className={cn("flex h-[560px] flex-col overflow-hidden rounded-[10px] border border-border bg-card", className)}>
      <div className={cn("flex items-center justify-between border-b border-border px-3.5 py-2.5", embedded && !streaming && "hidden")}>
        <div className={cn("text-[13px] font-semibold", embedded && "invisible")}>✨ Asistente</div>
        {streaming && (
          <button
            onClick={stop}
            className="cursor-pointer rounded border border-border px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
          >
            ■ Detener
          </button>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 space-y-2.5 overflow-y-auto px-3 py-3">
        {isLocal ? (
          <p className="px-1 text-xs leading-normal text-muted-foreground">
            El asistente necesita una sala real (con código) para poder guardar cambios. Crea o únete a un viaje.
          </p>
        ) : messages.length === 0 ? (
          <div className="space-y-2">
            <p className="px-1 text-xs leading-normal text-muted-foreground">
              Pídeme agregar actividades, tareas o gastos — los cambios aparecen en vivo para todo el grupo.
            </p>
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => sendMessage(ex)}
                className="block w-full cursor-pointer rounded-lg border border-dashed border-border bg-secondary px-2.5 py-1.5 text-left text-[11.5px] text-secondary-foreground hover:text-foreground"
              >
                {ex}
              </button>
            ))}
          </div>
        ) : (
          messages.map((m, i) => (
            <AgentMessageBubble
              key={i}
              message={m}
              streaming={streaming && i === messages.length - 1}
              busy={streaming}
              onDecide={(decisions) => decide(i, decisions)}
            />
          ))
        )}
      </div>

      <div className="flex gap-1.5 border-t border-border p-2.5 pb-[max(10px,env(safe-area-inset-bottom))] md:pb-2.5">
        <Textarea
          value={draft}
          maxLength={LIMITS.chatMessage}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendMessage(draft);
            }
          }}
          placeholder={isLocal ? "No disponible en modo local" : "Escribe una instrucción…"}
          disabled={isLocal || streaming}
          rows={2}
          className="min-h-0 flex-1 resize-none bg-secondary text-xs leading-normal"
        />
        <Button
          size="sm"
          onClick={() => sendMessage(draft)}
          disabled={isLocal || streaming || !draft.trim()}
          className="self-end font-semibold"
        >
          ➤
        </Button>
      </div>
    </div>
  );
}

