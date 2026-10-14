import { describe, it, expect, vi, beforeEach } from "vitest";
import { db, resetDb, supabaseServerMock } from "@/test/routeHelpers";

vi.mock("@/lib/supabase-server", () => supabaseServerMock);

const { POST } = await import("./route");

const report = (body: unknown, origin: string | null = "http://localhost") =>
  new Request("http://localhost/api/rooms/errors", {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": "test-browser", ...(origin ? { Origin: origin } : {}) },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

const inserts = () => db.mock.log.filter((q) => q.table === "app_errors");

beforeEach(() => {
  resetDb(() => undefined);
});

describe("POST /api/rooms/errors", () => {
  it("records a browser error", async () => {
    const res = await POST(report({ message: "x is undefined", stack: "at App", path: "/", context: "window.error" }));
    expect(res.status).toBe(204);
    expect(inserts()[0].values).toMatchObject({
      source: "client", message: "x is undefined", stack: "at App", path: "/", context: "window.error", user_agent: "test-browser",
    });
  });

  it("only accepts same-origin reports", async () => {
    expect((await POST(report({ message: "x" }, "https://evil.example"))).status).toBe(403);
    expect((await POST(report({ message: "x" }, null))).status).toBe(403);
    expect(inserts()).toHaveLength(0);
  });

  it("rejects bad shapes and oversized bodies", async () => {
    expect((await POST(report({ stack: "no message" }))).status).toBe(400);
    expect((await POST(report({ message: "x", path: 3 }))).status).toBe(400);
    expect((await POST(report("not json"))).status).toBe(400);
    expect((await POST(report({ message: "x", stack: "s".repeat(9000) }))).status).toBe(413);
    expect(inserts()).toHaveLength(0);
  });
});
