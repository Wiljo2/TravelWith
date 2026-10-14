import { reportClientError } from "@/lib/reportError";

// Runs before the app is interactive, so errors while it starts are reported too.
window.addEventListener("error", (e) => reportClientError(e.error ?? e.message, "window.error"));
window.addEventListener("unhandledrejection", (e) => reportClientError(e.reason, "unhandledrejection"));
