import { afterEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "@/server/http";
import { MAX_TOKEN_BYTES, signPending, verifyPending } from "@/server/agent/pending";

const base = {
  code: "ABC123",
  userId: "u1",
  messages: [{ role: "user", content: "hola" }],
  reads: [{ tool_use_id: "t1", content: "{}" }],
  actions: [{ id: "t2", name: "delete_task", kind: "delete" as const, summary: 'Eliminar tarea "X"' }],
  toolUses: [{ id: "t2", name: "delete_task", input: { taskId: "k1" } }],
};
const who = { code: "ABC123", userId: "u1" };

function expectHttp(fn: () => unknown, message?: string) {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(HttpError);
    expect((e as HttpError).status).toBe(400);
    if (message) expect((e as HttpError).message).toBe(message);
    return;
  }
  throw new Error("expected HttpError");
}

afterEach(() => vi.unstubAllEnvs());

describe("pending token", () => {
  it("round-trips", () => {
    const now = 1_000_000;
    const state = verifyPending(signPending(base, now), who, now + 1000);
    expect(state).toMatchObject(base);
    expect(state.exp).toBe(now + 15 * 60 * 1000);
  });

  it("rejects a tampered payload", () => {
    const [payload, sig] = signPending(base).split(".");
    const forged = Buffer.from(JSON.stringify({ ...base, userId: "u2", exp: Date.now() + 1e6 })).toString("base64url");
    expect(forged).not.toBe(payload);
    expectHttp(() => verifyPending(`${forged}.${sig}`, { code: "ABC123", userId: "u2" }));
  });

  it("rejects a tampered signature", () => {
    const [payload, sig] = signPending(base).split(".");
    const bad = `${sig.slice(0, -2)}${sig.endsWith("AA") ? "BB" : "AA"}`;
    expectHttp(() => verifyPending(`${payload}.${bad}`, who));
    expectHttp(() => verifyPending(`${payload}.short`, who));
  });

  it("rejects an expired token", () => {
    const now = 1_000_000;
    expectHttp(
      () => verifyPending(signPending(base, now), who, now + 15 * 60 * 1000 + 1),
      "La propuesta expiró. Pide el cambio de nuevo.",
    );
  });

  it("rejects another room or user", () => {
    const token = signPending(base);
    expectHttp(() => verifyPending(token, { code: "ZZZ999", userId: "u1" }));
    expectHttp(() => verifyPending(token, { code: "ABC123", userId: "u2" }));
  });

  it("rejects non-strings and malformed tokens", () => {
    for (const t of [undefined, null, 42, {}, "", "abc", "a.b.c"]) expectHttp(() => verifyPending(t, who));
  });

  it("rejects a token signed with a different secret", () => {
    vi.stubEnv("AGENT_RESUME_SECRET", "one");
    const token = signPending(base);
    vi.stubEnv("AGENT_RESUME_SECRET", "two");
    expectHttp(() => verifyPending(token, who));
  });

  it("enforces the size cap", () => {
    const big = { ...base, messages: ["x".repeat(MAX_TOKEN_BYTES)] };
    expect(() => signPending(big)).toThrow(/MAX_TOKEN_BYTES/);
  });

  it("throws in production without a secret", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AGENT_RESUME_SECRET", "");
    expect(() => signPending(base)).toThrow(/AGENT_RESUME_SECRET/);
    expect(() => verifyPending("a.b", who)).toThrow(/AGENT_RESUME_SECRET/);
  });

  it("works in production with a secret", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AGENT_RESUME_SECRET", "s3cret");
    expect(verifyPending(signPending(base), who).code).toBe("ABC123");
  });
});
