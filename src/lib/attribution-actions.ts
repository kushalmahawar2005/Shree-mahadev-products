"use server";

import { AttributionSchema, saveAttribution } from "@/lib/server/attribution";

export async function saveAttributionAction(raw: unknown) {
  const parsed = AttributionSchema.safeParse(raw);
  if (!parsed.success) return { ok: false };
  return { ok: await saveAttribution(parsed.data) };
}
