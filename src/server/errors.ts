import { after } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

export interface ErrorReport {
  source: "client" | "server";
  context?: string | null;
  message: string;
  stack?: string | null;
  path?: string | null;
  userAgent?: string | null;
}

// Mirrors the checks of 024_app_errors.sql.
export const ERROR_LIMITS = { context: 120, message: 1000, stack: 8000, path: 300, userAgent: 300 } as const;

const cut = (value: string | null | undefined, max: number) => (value ? value.slice(0, max) : null);

export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  const message = (e as { message?: unknown } | null)?.message;
  return typeof message === "string" ? message : String(e);
}

// Kept in app_errors so failures can be looked at later (Vercel's runtime logs
// expire within hours). Never throws: reporting must not break the request.
export async function recordError(report: ErrorReport): Promise<void> {
  try {
    const { error } = await createServerClient().from("app_errors").insert({
      source: report.source,
      context: cut(report.context, ERROR_LIMITS.context),
      message: cut(report.message, ERROR_LIMITS.message) || "(sin mensaje)",
      stack: cut(report.stack, ERROR_LIMITS.stack),
      path: cut(report.path, ERROR_LIMITS.path),
      user_agent: cut(report.userAgent, ERROR_LIMITS.userAgent),
    });
    if (error) console.error("[errors] could not record", error);
  } catch (e) {
    console.error("[errors] could not record", e);
  }
}

// A server failure, recorded once the response is sent.
export function reportServerError(context: string, e: unknown): void {
  const report: ErrorReport = { source: "server", context, message: errorMessage(e), stack: e instanceof Error ? e.stack : null };
  try {
    after(() => recordError(report));
  } catch {
    void recordError(report); // outside a request (tests, scripts)
  }
}
