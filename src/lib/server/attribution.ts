import "server-only";
import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "./db";

export const ATTRIBUTION_COOKIE = "smp_attribution";
export const AttributionSchema = z.object({
  utm_source: z.string().max(100).nullable(),
  utm_medium: z.string().max(100).nullable(),
  utm_campaign: z.string().max(150).nullable(),
  utm_content: z.string().max(150).nullable(),
  utm_term: z.string().max(150).nullable(),
  fbclid: z.string().max(255).nullable(),
  fbc: z.string().max(255).nullable(),
  fbp: z.string().max(255).nullable(),
  gclid: z.string().max(255).nullable(),
  landing_page: z.string().max(500).nullable(),
  referrer: z.string().max(500).nullable(),
  client_id: z.string().max(100).nullable(),
  marketing_consent: z.boolean().default(false),
}).strict();

export type Attribution = z.infer<typeof AttributionSchema>;
export const emptyAttribution = (): Attribution => ({
  utm_source: null, utm_medium: null, utm_campaign: null, utm_content: null,
  utm_term: null, fbclid: null, fbc: null, fbp: null, gclid: null,
  landing_page: null, referrer: null, client_id: null, marketing_consent: false,
});

export async function readAttributionCookie(): Promise<Attribution> {
  const raw = (await cookies()).get(ATTRIBUTION_COOKIE)?.value;
  if (!raw) return emptyAttribution();
  try {
    return AttributionSchema.parse(JSON.parse(decodeURIComponent(raw)));
  } catch {
    return emptyAttribution();
  }
}

export function attributionValues(a: Attribution) {
  return [a.utm_source, a.utm_medium, a.utm_campaign, a.utm_content, a.utm_term,
    a.fbclid, a.fbc, a.fbp, a.gclid, a.client_id, a.landing_page, a.referrer, a.marketing_consent ? 1 : 0];
}

export async function syncAttributionToCart(a: Attribution) {
  const token = (await cookies()).get("smp_cid")?.value;
  if (!token || !/^[a-f0-9]{32}$/.test(token)) return;
  await db().execute(
    `UPDATE carts SET utm_source=?,utm_medium=?,utm_campaign=?,utm_content=?,utm_term=?,fbclid=?,fbc=?,fbp=?,gclid=?,client_id=?,landing_page=?,referrer=?,marketing_consent=? WHERE token=?`,
    [...attributionValues(a), token],
  );
}

export async function saveAttribution(raw: unknown) {
  const parsed = AttributionSchema.safeParse(raw);
  if (!parsed.success) return false;
  const jar = await cookies();
  jar.set(ATTRIBUTION_COOKIE, encodeURIComponent(JSON.stringify(parsed.data)), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 90,
  });
  await syncAttributionToCart(parsed.data).catch((error) => console.error("syncAttributionToCart", error));
  return true;
}
