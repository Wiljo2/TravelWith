import { describe, it, expect, vi } from "vitest";
import { db, resetDb, supabaseServerMock } from "@/test/routeHelpers";

vi.mock("@/lib/supabase-server", () => supabaseServerMock);

const { errorMessage, recordError, reportServerError } = await import("./errors");

describe("error recording", () => {
  it("stores a report within the table's limits", async () => {
    resetDb(() => undefined);
    await recordError({ source: "client", context: "x".repeat(500), message: "m".repeat(5000), stack: "s".repeat(20000), path: "/", userAgent: "ua" });
    const insert = db.mock.log.find((q) => q.table === "app_errors" && q.op === "insert")!;
    expect(insert.values).toMatchObject({ source: "client", path: "/", user_agent: "ua" });
    const row = insert.values as Record<string, string>;
    expect([row.context.length, row.message.length, row.stack.length]).toEqual([120, 1000, 8000]);
  });

  it("never throws when the database fails", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    resetDb(() => ({ error: { message: "down" } }));
    await expect(recordError({ source: "server", message: "boom" })).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("records outside a request too", async () => {
    resetDb(() => undefined);
    reportServerError("job", new Error("boom"));
    await vi.waitFor(() => expect(db.mock.log.some((q) => q.table === "app_errors")).toBe(true));
    expect(db.mock.log.find((q) => q.table === "app_errors")!.values).toMatchObject({ source: "server", context: "job", message: "boom" });
  });

  it("reads the message of errors that are not Error instances", () => {
    expect(errorMessage({ message: "relation does not exist", code: "42P01" })).toBe("relation does not exist");
    expect(errorMessage("plain")).toBe("plain");
  });
});
