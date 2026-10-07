"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { LIMITS } from "@/constants/limits";

export interface AgentChatMessage {
  role: "user" | "assistant";
  content: string;
  tools?: string[];
  error?: boolean;
}

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
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const isLocal = roomCode === "LOCAL";

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, streaming]);

  useEffect(() => () => abortRef.current?.abort(), []);

  function appendToAssistant(patch: (last: AgentChatMessage) => AgentChatMessage) {
    setMessages((prev) => {
      const next = [...prev];
      const last = next[next.length - 1];
      if (last?.role === "assistant") next[next.length - 1] = patch(last);
      return next;
    });
  }

  async function sendMessage(text: string) {
    const content = text.trim();
    if (!content || streaming || isLocal) return;

    const history = [...messages.filter((m) => m.content.trim()), { role: "user" as const, content }];
    setMessages((prev) => [
      ...prev,
      { role: "user", content },
      { role: "assistant", content: "", tools: [] },
    ]);
    setDraft("");
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await apiFetch(`/api/rooms/${roomCode}/agent`, accessToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history.map(({ role, content }) => ({ role, content })) }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null);
        appendToAssistant((m) => ({ ...m, content: data?.error ?? "Error del asistente.", error: true }));
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";
        for (const frame of frames) {
          const line = frame.split("\n").find((l) => l.startsWith("data: "));
          if (!line) continue;
          const event = JSON.parse(line.slice(6));

          if (event.type === "text") {
            appendToAssistant((m) => ({ ...m, content: m.content + event.delta }));
          } else if (event.type === "tool") {
            appendToAssistant((m) => ({ ...m, tools: [...(m.tools ?? []), event.label] }));
          } else if (event.type === "error") {
            appendToAssistant((m) => ({
              ...m,
              content: m.content ? `${m.content}\n\n${event.message}` : event.message,
              error: true,
            }));
          }
        }
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        appendToAssistant((m) => ({ ...m, content: m.content || "No se pudo contactar al asistente.", error: true }));
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
      appendToAssistant((m) => (m.content ? m : { ...m, content: "(sin respuesta)" }));
    }
  }

  return (
    <div className={cn("flex h-[560px] flex-col overflow-hidden rounded-[10px] border border-border bg-card", className)}>
      <div className={cn("flex items-center justify-between border-b border-border px-3.5 py-2.5", embedded && !streaming && "hidden")}>
        <div className={cn("text-[13px] font-semibold", embedded && "invisible")}>✨ Asistente</div>
        {streaming && (
          <button
            onClick={() => abortRef.current?.abort()}
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
          messages.map((m, i) => <MessageBubble key={i} message={m} streaming={streaming && i === messages.length - 1} />)
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

function MessageBubble({ message, streaming }: { message: AgentChatMessage; streaming: boolean }) {
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
      {(message.content || !streaming) && (
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
      {!message.content && streaming && (
        <div className="px-2.5 py-1 text-[11px] text-muted-foreground">
          <span className="animate-pulse">Pensando…</span>
        </div>
      )}
    </div>
  );
}
