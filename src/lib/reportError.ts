const ENDPOINT = "/api/rooms/errors";
const MAX_REPORTS = 10;
// Browser noise that says nothing about the app.
const IGNORED = /ResizeObserver loop|chrome-extension:|moz-extension:|safari-(web-)?extension:/;

const sent = new Set<string>();

// Sends an error the app didn't handle to POST /api/rooms/errors (production
// builds only): each message once per page load, at most MAX_REPORTS.
export function reportClientError(error: unknown, context: string): void {
  if (process.env.NODE_ENV !== "production" || typeof window === "undefined") return;
  const err = error instanceof Error ? error : null;
  const message = (err?.message || String(error ?? "")).slice(0, 1000);
  const stack = err?.stack?.slice(0, 6000) ?? null;
  if (!message || IGNORED.test(`${message}\n${stack ?? ""}`) || sent.has(message) || sent.size >= MAX_REPORTS) return;
  sent.add(message);
  const body = JSON.stringify({ context, message, stack, path: location.pathname });
  try {
    if (navigator.sendBeacon?.(ENDPOINT, new Blob([body], { type: "application/json" }))) return;
  } catch {
    // Fall back to fetch.
  }
  fetch(ENDPOINT, { method: "POST", body, keepalive: true, headers: { "Content-Type": "application/json" } }).catch(() => {});
}
