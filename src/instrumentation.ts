import type { Instrumentation } from "next";

// Server errors nothing caught (route handlers answer theirs with errorResponse,
// which records them). The query string is dropped: it can carry auth codes.
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { errorMessage, recordError } = await import("@/server/errors");
  await recordError({
    source: "server",
    context: `${request.method} ${context.routePath} (${context.routeType})`,
    message: errorMessage(err),
    stack: err instanceof Error ? err.stack : null,
    path: request.path.split("?")[0],
  });
};
