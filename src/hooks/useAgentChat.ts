"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { applyFrame, buildHistory, expirePending, resolvePending, type AgentFrame } from "@/components/agent/agentChat";
import type { AgentChatMessage, AgentDecision } from "@/types";

interface UseAgentChatArgs {
  roomCode: string;
  accessToken: string | undefined;
  messages: AgentChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<AgentChatMessage[]>>;
}

export function useAgentChat({ roomCode, accessToken, messages, setMessages }: UseAgentChatArgs) {
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const isLocal = roomCode === "LOCAL";

  useEffect(() => () => abortRef.current?.abort(), []);

  const patchLast = useCallback(
    (patch: (last: AgentChatMessage) => AgentChatMessage) => {
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last?.role === "assistant") next[next.length - 1] = patch(last);
        return next;
      });
    },
    [setMessages],
  );

  const runStream = useCallback(
    async (body: unknown): Promise<number | null> => {
      setStreaming(true);
      const controller = new AbortController();
      abortRef.current = controller;
      let failedStatus: number | null = null;

      try {
        const res = await apiFetch(`/api/rooms/${roomCode}/agent`, accessToken, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          failedStatus = res.status;
          const data = await res.json().catch(() => null);
          patchLast((m) => ({ ...m, content: data?.error ?? "Error del asistente.", error: true }));
          return failedStatus;
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
            const event = JSON.parse(line.slice(6)) as AgentFrame;
            patchLast((m) => applyFrame(m, event));
          }
        }
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          patchLast((m) => ({ ...m, content: m.content || "No se pudo contactar al asistente.", error: true }));
        }
      } finally {
        setStreaming(false);
        abortRef.current = null;
        patchLast((m) => (m.content || m.pending ? m : { ...m, content: "(sin respuesta)" }));
      }
      return failedStatus;
    },
    [roomCode, accessToken, patchLast],
  );

  const send = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!content || streaming || isLocal) return;

      const history = buildHistory(messages, content);
      setMessages((prev) => [
        ...expirePending(prev),
        { role: "user", content },
        { role: "assistant", content: "", tools: [] },
      ]);
      await runStream({ messages: history });
    },
    [messages, streaming, isLocal, setMessages, runStream],
  );

  const decide = useCallback(
    async (index: number, decisions: AgentDecision[]) => {
      const pending = messages[index]?.pending;
      if (!pending || pending.status !== "pending" || streaming || isLocal) return;

      setMessages((prev) => [
        ...prev.map((m, i) => (i === index && m.pending ? { ...m, pending: resolvePending(m.pending, decisions) } : m)),
        { role: "assistant", content: "", tools: [] },
      ]);
      const status = await runStream({ resume: { token: pending.token, decisions } });
      if (status === 400) {
        setMessages((prev) =>
          prev.map((m, i) => (i === index && m.pending ? { ...m, pending: { ...m.pending, status: "expired" } } : m)),
        );
      }
    },
    [messages, streaming, isLocal, setMessages, runStream],
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);

  return { streaming, send, decide, stop };
}
