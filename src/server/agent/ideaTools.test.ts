import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock, type QueryHandler } from "@/test/supabaseMock";
import type { OpContext } from "@/server/ops/types";

let handler: QueryHandler = () => undefined;
let mock = createSupabaseMock((q) => handler(q));

vi.mock("@/lib/supabase-server", () => ({ createServerClient: () => mock.client }));

const { AGENT_TOOLS, executeTool } = await import("@/server/agent/tools");
const { describeAction, toolKind } = await import("@/server/agent/actions");

const ctx: OpContext = { code: "ABCD1234", userId: "u-owner", role: "owner" };
const row = (id: string, data: object) => ({ room_code: "ABCD1234", id, position: 0, data, version: 1, updated_at: "t", updated_by: null });
const saved = row("i1", {
  url: "https://vt.tiktok.com/ZSbbsDUhE/", platform: "tiktok", createdAt: "t", title: "5 viral Miami restaurants",
  video: { status: "done", summary: "Cinco restaurantes en Miami.", spots: [{ name: "Miami Slice", city: "Miami", price: "$30 PP", cat: "comida" }] },
});

beforeEach(() => {
  mock = createSupabaseMock((q) => handler(q));
  vi.unstubAllEnvs();
});

describe("idea tools", () => {
  it("are offered to the model", () => {
    const names = AGENT_TOOLS.map((t) => t.name);
    expect(names).toEqual(expect.arrayContaining(["get_ideas", "add_idea"]));
  });

  it("reading needs no approval; saving shows a summary to approve", () => {
    expect(toolKind("get_ideas")).toBe("read");
    expect(toolKind("add_idea")).toBe("write");
    expect(describeAction(null, "add_idea", { url: "https://vt.tiktok.com/ZSbSxNFg8/", note: "día en Miami" }))
      .toBe('Guardar idea https://vt.tiktok.com/ZSbSxNFg8/ · "día en Miami"');
  });

  it("get_ideas includes what the video showed", async () => {
    handler = (q) => (q.table === "trip_ideas" ? { data: [saved, row("i2", { url: "https://x.com", platform: "other", createdAt: "t", status: "discarded" })] } : undefined);
    const outcome = await executeTool(ctx, "get_ideas", {});
    const body = JSON.parse(outcome.content);
    expect(body.count).toBe(1);
    expect(body.ideas[0].video).toMatchObject({ status: "done", summary: "Cinco restaurantes en Miami.", spots: ["Miami Slice · Miami · $30 PP"] });
  });

  it("add_idea saves a new link through idea.create", async () => {
    handler = (q) => {
      if (q.table === "trip_ideas" && q.op === "select") return { data: [saved] };
      if (q.op === "insert") return { data: { ...(q.values as object), version: 1 } };
    };
    const outcome = await executeTool(ctx, "add_idea", { url: "mira esto vt.tiktok.com/ZSbSxNFg8/", note: "para el día en Miami" });
    expect(outcome.isError).toBe(false);
    const insert = mock.log.find((q) => q.op === "insert")?.values as { data: Record<string, unknown>; updated_by: string };
    expect(insert.data).toMatchObject({ url: "https://vt.tiktok.com/ZSbSxNFg8/", platform: "tiktok", note: "para el día en Miami", status: "idea" });
    expect(insert.updated_by).toBe("u-owner");
  });

  it("add_idea doesn't save the same video twice", async () => {
    handler = (q) => (q.table === "trip_ideas" && q.op === "select" ? { data: [saved] } : undefined);
    const outcome = await executeTool(ctx, "add_idea", { url: "https://vt.tiktok.com/ZSbbsDUhE/" });
    expect(JSON.parse(outcome.content)).toMatchObject({ alreadySaved: true });
    expect(mock.log.some((q) => q.op === "insert")).toBe(false);
  });

  it("add_idea rejects text without a link", async () => {
    const outcome = await executeTool(ctx, "add_idea", { url: "un restaurante bueno" });
    expect(outcome.isError).toBe(true);
  });
});
