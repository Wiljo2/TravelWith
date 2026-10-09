import { describe, expect, it } from "vitest";
import { applyFrame, buildHistory, expirePending, resolvePending } from "@/components/agent/agentChat";
import type { AgentChatMessage, AgentPending } from "@/types";

const actions = [
  { id: "a1", name: "create_event", kind: "write" as const, summary: 'Crear actividad "Cena" · Sáb 14' },
  { id: "a2", name: "delete_task", kind: "delete" as const, summary: 'Eliminar tarea "X"' },
];
const pending = (over: Partial<AgentPending> = {}): AgentPending => ({
  token: "t",
  actions,
  status: "pending",
  ...over,
});
const assistant = (content: string, p?: AgentPending): AgentChatMessage => ({ role: "assistant", content, pending: p });

describe("applyFrame", () => {
  const base: AgentChatMessage = { role: "assistant", content: "Hola", tools: [] };

  it("appends text deltas", () => {
    expect(applyFrame(base, { type: "text", delta: " mundo" }).content).toBe("Hola mundo");
  });
  it("appends tool labels", () => {
    expect(applyFrame(base, { type: "tool", name: "x", label: "Leyendo" }).tools).toEqual(["Leyendo"]);
  });
  it("appends errors and flags the message", () => {
    const withError = applyFrame(base, { type: "error", message: "Falló" });
    expect(withError).toMatchObject({ content: "Hola\n\nFalló", error: true });
    expect(applyFrame({ ...base, content: "" }, { type: "error", message: "Falló" }).content).toBe("Falló");
  });
  it("sets a pending proposal on confirm", () => {
    const m = applyFrame(base, { type: "confirm", token: "tok", actions });
    expect(m.pending).toEqual({ token: "tok", actions, status: "pending" });
  });
  it("ignores done", () => {
    expect(applyFrame(base, { type: "done" })).toBe(base);
  });
});

describe("buildHistory", () => {
  it("keeps non-empty turns and appends the new user text", () => {
    const history = buildHistory([{ role: "user", content: "a" }, assistant("  ")], "b");
    expect(history).toEqual([
      { role: "user", content: "a" },
      { role: "user", content: "b" },
    ]);
  });

  it("traces approved and rejected actions", () => {
    const p = resolvePending(pending(), [
      { id: "a1", approve: true },
      { id: "a2", approve: false },
    ]);
    expect(p.status).toBe("approved");
    const [turn] = buildHistory([assistant("Propongo esto", p)]);
    expect(turn.content).toBe(
      'Propongo esto\n[Propuesta: Crear actividad "Cena" · Sáb 14 → aprobada; Eliminar tarea "X" → rechazada]',
    );
  });

  it("marks a fully rejected proposal", () => {
    const p = resolvePending(pending(), actions.map((a) => ({ id: a.id, approve: false })));
    expect(p.status).toBe("rejected");
    expect(buildHistory([assistant("", p)])[0].content).toBe(
      '[Propuesta: Crear actividad "Cena" · Sáb 14 → rechazada; Eliminar tarea "X" → rechazada]',
    );
  });

  it("produces a turn for an empty assistant message with a proposal", () => {
    expect(buildHistory([assistant("", pending())])).toHaveLength(1);
  });

  it("reports expired and still-pending proposals as expirada", () => {
    for (const status of ["expired", "pending"] as const) {
      const [turn] = buildHistory([assistant("", pending({ status }))]);
      expect(turn.content).toBe('[Propuesta: Crear actividad "Cena" · Sáb 14 → expirada; Eliminar tarea "X" → expirada]');
    }
  });
});

describe("expirePending", () => {
  it("expires only pending proposals", () => {
    const approved = pending({ status: "approved", decisions: [] });
    const result = expirePending([assistant("a", pending()), assistant("b", approved)]);
    expect(result[0].pending?.status).toBe("expired");
    expect(result[1].pending?.status).toBe("approved");
  });
});
