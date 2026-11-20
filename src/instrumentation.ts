import type { Instrumentation } from "next";

/**
 * Server error monitoring: every error Next.js catches (page render, API route, server action, proxy)
 * is grouped in `error_log` and shown at /admin/errors; a new kind of error emails the store.
 * Headers, cookies and query strings are never stored.
 */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const e = err as { message?: string; stack?: string; digest?: string };
  const { recordError } = await import("@/lib/error-capture");
  await recordError({
    source: "server",
    message: e?.message ?? String(err),
    stack: e?.stack ?? null,
    digest: e?.digest ?? null,
    path: request.path,
    method: request.method,
    route: context.routePath,
    routeType: context.routeType,
  });
};
