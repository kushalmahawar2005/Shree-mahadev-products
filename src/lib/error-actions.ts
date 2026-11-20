"use server";

import { z } from "zod";
import { recordError } from "@/lib/error-capture";
import { clientIp, rateLimit } from "@/lib/server/rate-limit";

/** A page crashed in a shopper's browser (error boundary). Rate limited per IP; no personal data stored. */
export async function reportClientErrorAction(raw: unknown) {
  const p = z
    .object({ message: z.string().max(1000), digest: z.string().max(64).optional(), path: z.string().max(300), stack: z.string().max(4000).optional() })
    .strict()
    .safeParse(raw);
  if (!p.success) return;
  const limit = await rateLimit("client_error", await clientIp(), 20, 60);
  if (!limit.ok) return;
  await recordError({ source: "client", routeType: "browser", ...p.data });
}
