import "server-only";
import type { RowDataPacket } from "mysql2/promise";
import { db } from "./db";

export async function getMarketingSummary() {
  const [events] = await db().query<RowDataPacket[]>(
    `SELECT id, event_name, event_id, status, attempts, last_error, created_at, sent_at
     FROM marketing_outbox ORDER BY id DESC LIMIT 50`,
  );
  const [sources] = await db().query<RowDataPacket[]>(
    `SELECT COALESCE(NULLIF(utm_source, ''), 'Direct / unknown') AS source,
            COUNT(*) AS orders, SUM(total) AS revenue
     FROM orders WHERE status NOT IN ('cancelled', 'payment_failed')
     GROUP BY COALESCE(NULLIF(utm_source, ''), 'Direct / unknown')
     ORDER BY revenue DESC LIMIT 20`,
  );
  const [[counts]] = await db().query<RowDataPacket[]>(
    `SELECT COUNT(*) AS orders, SUM(marketing_consent = 1) AS consented,
            SUM(utm_source IS NOT NULL AND utm_source <> '') AS attributed
     FROM orders WHERE status NOT IN ('cancelled', 'payment_failed')`,
  );
  return {
    events: events.map((row) => ({ id: Number(row.id), name: String(row.event_name), eventId: String(row.event_id), status: String(row.status), attempts: Number(row.attempts), error: row.last_error as string | null, createdAt: String(row.created_at), sentAt: row.sent_at as string | null })),
    sources: sources.map((row) => ({ source: String(row.source), orders: Number(row.orders), revenue: Number(row.revenue ?? 0) })),
    counts: { orders: Number(counts.orders), consented: Number(counts.consented ?? 0), attributed: Number(counts.attributed ?? 0) },
  };
}

export type MarketingOrder = {
  id: number;
  orderNo: string;
  customer: string;
  total: number;
  status: string;
  method: string;
  createdAt: string;
  channel: string;
  kind: "ads" | "campaign" | "search" | "social" | "referral" | "direct";
  medium: string | null;
  campaign: string | null;
  content: string | null;
  term: string | null;
  landingPage: string | null;
  referrer: string | null;
  consent: boolean;
  event: { status: string; attempts: number; error: string | null } | null;
};

const host = (url: string | null) => {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
};

/** Where an order came from, in plain words: ad click ids first, then UTM tags, then the referrer. */
function channelOf(r: RowDataPacket): Pick<MarketingOrder, "channel" | "kind"> {
  const src = String(r.utm_source ?? "").trim();
  if (r.gclid) return { channel: "Google Ads", kind: "ads" };
  if (r.fbclid) return { channel: /insta/i.test(src) ? "Instagram Ads" : "Meta Ads", kind: "ads" };
  if (src) return { channel: src, kind: /cpc|paid|ads?$/i.test(String(r.utm_medium ?? "")) ? "ads" : "campaign" };
  const ref = host(r.referrer ? String(r.referrer) : null);
  const own = host(process.env.NEXT_PUBLIC_SITE_URL ?? null);
  if (!ref || ref === own) return { channel: "Direct", kind: "direct" };
  if (/google\.|bing\.|duckduckgo\.|yahoo\./.test(ref)) return { channel: `${ref.split(".")[0][0].toUpperCase()}${ref.split(".")[0].slice(1)} search`, kind: "search" };
  if (/instagram|facebook|fb\.|whatsapp|youtube|t\.co|twitter|x\.com/.test(ref)) return { channel: ref, kind: "social" };
  return { channel: ref, kind: "referral" };
}

/**
 * Latest orders, newest first, with their source (UTM / ad click / referrer) and the server event
 * status. `onlyMarketing` keeps orders that came from an ad, campaign link, search, social or another site.
 */
export async function getMarketingOrders(onlyMarketing: boolean, limit = 100): Promise<MarketingOrder[]> {
  const [rows] = await db().query<RowDataPacket[]>(
    `SELECT o.id, o.order_no, o.customer_name, o.total, o.status, o.payment_method, o.created_at,
            o.utm_source, o.utm_medium, o.utm_campaign, o.utm_content, o.utm_term, o.gclid, o.fbclid,
            o.landing_page, o.referrer, o.marketing_consent,
            m.status AS ev_status, m.attempts AS ev_attempts, m.last_error AS ev_error
     FROM orders o
     LEFT JOIN marketing_outbox m ON m.order_id = o.id AND m.event_name = 'Purchase'
     WHERE o.status NOT IN ('pending_payment', 'payment_failed')
     ORDER BY o.created_at DESC, o.id DESC
     LIMIT ?`,
    [onlyMarketing ? 500 : limit],
  );
  const list = rows.map((r): MarketingOrder => ({
    id: Number(r.id),
    orderNo: String(r.order_no),
    customer: String(r.customer_name ?? ""),
    total: Number(r.total ?? 0),
    status: String(r.status),
    method: String(r.payment_method ?? ""),
    createdAt: String(r.created_at),
    ...channelOf(r),
    medium: r.utm_medium ? String(r.utm_medium) : null,
    campaign: r.utm_campaign ? String(r.utm_campaign) : null,
    content: r.utm_content ? String(r.utm_content) : null,
    term: r.utm_term ? String(r.utm_term) : null,
    landingPage: r.landing_page ? String(r.landing_page) : null,
    referrer: r.referrer ? String(r.referrer) : null,
    consent: Boolean(r.marketing_consent),
    event: r.ev_status ? { status: String(r.ev_status), attempts: Number(r.ev_attempts ?? 0), error: r.ev_error ? String(r.ev_error) : null } : null,
  }));
  return onlyMarketing ? list.filter((o) => o.kind !== "direct").slice(0, limit) : list;
}
