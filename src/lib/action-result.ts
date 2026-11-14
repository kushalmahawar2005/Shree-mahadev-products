import { unstable_rethrow } from "next/navigation";

/**
 * Result shape for server actions called from client components.
 *
 * In production Next.js hides the message of any Error thrown inside a server
 * action (the client only sees "Minified React error #441"). Returning the
 * message as data keeps the real reason (e.g. NimbusPost's reply) visible.
 */
export type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: string };

/** Server side: run an action body and turn thrown errors into `{ ok: false }`. */
export async function safe<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    // Keep redirect()/notFound() (e.g. from requireAdmin) working.
    unstable_rethrow(e);
    console.error("[action]", e);
    // zod errors: show the first issue, not the JSON dump (no zod import, keeps it client-safe).
    const issue = (e as { name?: string; issues?: { path: PropertyKey[]; message: string }[] })?.issues?.[0];
    const msg = issue && (e as Error).name === "ZodError"
      ? `${issue.path.map(String).join(" › ") || "Input"}: ${issue.message}`
      : e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg || "Something went wrong" };
  }
}

/** Client (or server) side: get the data, or throw an Error with the real message. */
export function unwrap<T>(r: ActionResult<T>): T {
  if (!r.ok) throw new Error(r.error);
  return r.data;
}
