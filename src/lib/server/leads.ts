import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { DEFAULT_LEAD_POPUP, LeadPopupSchema, type LeadPopupConfig, type PublicLeadPopup } from "@/lib/lead-popup";
import { db } from "./db";
import { getSetting, setSetting } from "./videos";

export const LEAD_POPUP_TAG = "lead-popup";
const KEY = "lead_popup";

/** Orders in these states count as "ordered" for a lead. */
const PLACED = ["paid", "cod_pending", "confirmed", "packed", "shipped", "delivered"];

export async function getLeadPopupConfig(): Promise<LeadPopupConfig> {
  const raw = await getSetting<unknown>(KEY, DEFAULT_LEAD_POPUP);
  const ok = LeadPopupSchema.safeParse({ ...DEFAULT_LEAD_POPUP, ...(raw as object) });
  return ok.success ? ok.data : DEFAULT_LEAD_POPUP;
}

export async function saveLeadPopupConfig(c: LeadPopupConfig) {
  await setSetting(KEY, c);
}

/** Active percent coupon behind the popup, or null when it is missing / expired / paused. */
async function popupCoupon(code: string) {
  if (!code) return null;
  const [rows] = await db().execute<RowDataPacket[]>(
    `SELECT code, value FROM coupons
     WHERE code = ? AND active = 1 AND kind = 'percent'
       AND (starts_at IS NULL OR starts_at <= NOW()) AND (ends_at IS NULL OR ends_at > NOW())
       AND (usage_limit IS NULL OR used_count < usage_limit)`,
    [code],
  );
  return rows[0] ? { code: String(rows[0].code), percent: Number(rows[0].value) } : null;
}

/** Storefront view (cached; admin save calls updateTag). Null = popup off. */
export async function getPublicLeadPopup(): Promise<PublicLeadPopup> {
  "use cache";
  cacheLife("hours");
  cacheTag(LEAD_POPUP_TAG);
  if (!process.env.DATABASE_NAME) return null;
  try {
    const c = await getLeadPopupConfig();
    if (!c.enabled) return null;
    const coupon = await popupCoupon(c.couponCode);
    return coupon ? { delaySec: c.delaySec, percent: coupon.percent } : null;
  } catch (e) {
    console.error("getPublicLeadPopup", e);
    return null;
  }
}

/** Save (or refresh) a lead, copy the contact onto their cart, and return the code to show. */
export async function captureLead(input: { name: string; phone: string; page: string; cartToken?: string }) {
  const c = await getLeadPopupConfig();
  const coupon = c.enabled ? await popupCoupon(c.couponCode) : null;
  if (!coupon) return null;
  await db().execute(
    `INSERT INTO leads (name, phone, page, coupon_code, cart_token) VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE name = VALUES(name), page = VALUES(page), coupon_code = VALUES(coupon_code),
       cart_token = COALESCE(VALUES(cart_token), cart_token)`,
    [input.name, input.phone, input.page.slice(0, 255), coupon.code, input.cartToken ?? null],
  );
  if (input.cartToken) {
    // Makes the abandoned-cart row reachable without marking it as "reached checkout".
    await db().execute(
      "UPDATE carts SET name = COALESCE(name, ?), phone = COALESCE(phone, ?) WHERE token = ? AND status = 'active'",
      [input.name, input.phone, input.cartToken],
    );
  }
  return coupon;
}

export type AdminLead = {
  id: number;
  name: string;
  phone: string;
  page: string | null;
  couponCode: string | null;
  createdAt: string;
  contactedAt: string | null;
  orderNo: string | null;
};

export async function listLeads(): Promise<AdminLead[]> {
  const [rows] = await db().query<RowDataPacket[]>(
    `SELECT l.*,
       (SELECT o.order_no FROM orders o
         WHERE o.phone = l.phone AND o.status IN (?) AND o.created_at >= l.created_at
         ORDER BY o.created_at LIMIT 1) AS order_no
     FROM leads l WHERE l.created_at > NOW() - INTERVAL 90 DAY
     ORDER BY l.created_at DESC LIMIT 500`,
    [PLACED],
  );
  return rows.map((r) => ({
    id: Number(r.id),
    name: String(r.name),
    phone: String(r.phone),
    page: r.page ? String(r.page) : null,
    couponCode: r.coupon_code ? String(r.coupon_code) : null,
    createdAt: String(r.created_at),
    contactedAt: r.contacted_at ? String(r.contacted_at) : null,
    orderNo: r.order_no ? String(r.order_no) : null,
  }));
}

export async function markLeadContacted(id: number) {
  const [res] = await db().execute<ResultSetHeader>("UPDATE leads SET contacted_at = NOW() WHERE id = ?", [id]);
  return res.affectedRows > 0;
}
