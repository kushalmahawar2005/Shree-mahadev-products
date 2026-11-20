import Link from "next/link";
import { CheckCircle2, CircleDashed, ExternalLink, Megaphone, Radio, Rss, ShieldCheck, ShoppingBag, Target } from "lucide-react";
import { CopyButton } from "@/components/admin/order/CopyButton";
import { StatTile } from "@/components/admin/ui";
import { requireRole } from "@/lib/server/admin-auth";
import { getMarketingOrders, getMarketingSummary, type MarketingOrder } from "@/lib/server/marketing-admin";
import { formatMoney } from "@/lib/utils/money";
import { cn } from "@/lib/utils/cn";

export const metadata = { title: "Marketing" };
export const instant = false;

const card = "rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgba(0,0,0,.04)]";
const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : "-");
const when = (d: string) =>
  new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(d.replace(" ", "T") + "+05:30"));

/** Which tracking tools are configured (env vars only; values never leave the server). */
const TOOLS = [
  { name: "Google Analytics 4", hint: "Browser tag", on: !!process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID },
  { name: "GA4 server events", hint: "Measurement Protocol", on: !!(process.env.GA4_MEASUREMENT_ID && process.env.GA4_API_SECRET) },
  { name: "Google Ads", hint: "Conversion tag", on: !!process.env.NEXT_PUBLIC_GOOGLE_ADS_ID },
  { name: "Meta Pixel", hint: "Browser pixel", on: !!process.env.NEXT_PUBLIC_META_PIXEL_ID },
  { name: "Meta Conversions API", hint: "Server events", on: !!(process.env.META_PIXEL_ID && process.env.META_CAPI_TOKEN) },
  { name: "Microsoft Clarity", hint: "Heatmaps", on: !!process.env.NEXT_PUBLIC_CLARITY_ID },
];

export default async function MarketingPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  await requireRole("owner", "manager");
  const onlyMarketing = (await searchParams).show === "marketing";
  const [data, sourcedOrders] = await Promise.all([getMarketingSummary(), getMarketingOrders(onlyMarketing)]);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://your-domain.example";
  const { orders, consented, attributed } = data.counts;
  const failed = data.events.filter((e) => e.status !== "sent").length;
  const topRevenue = Math.max(1, ...data.sources.map((s) => s.revenue));
  const feeds = [
    { name: "Google Merchant Center", url: `${siteUrl}/feeds/google.xml` },
    { name: "Meta Commerce Manager", url: `${siteUrl}/feeds/meta.xml` },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-forest-text sm:text-3xl">Marketing</h1>
        <p className="mt-1 text-sm text-ink-muted">Where orders come from, product feeds for ads, and tracking health.</p>
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4" aria-label="Summary">
        <StatTile icon={ShoppingBag} label="Orders" value={String(orders)} note="Excludes cancelled / failed" />
        <StatTile icon={ShieldCheck} label="Marketing consent" value={pct(consented, orders)} note={`${consented} of ${orders} orders`} />
        <StatTile icon={Target} label="Attributed to a campaign" value={pct(attributed, orders)} note={`${attributed} orders with UTM / click id`} />
        <StatTile icon={Radio} label="Server events" value={String(data.events.length)} note={failed ? `${failed} not sent yet` : "All delivered"} tone={failed ? "warn" : undefined} />
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel icon={Megaphone} title="Orders by source" hint="Revenue per traffic source">
          {data.sources.length ? (
            <ul className="space-y-3">
              {data.sources.map((s) => (
                <li key={s.source}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="truncate text-ink">
                      {s.source} <span className="text-ink-muted">· {s.orders} order{s.orders === 1 ? "" : "s"}</span>
                    </span>
                    <span className="font-semibold text-ink tabular-nums">{formatMoney(s.revenue)}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-subtle">
                    <div className="h-full rounded-full bg-forest" style={{ width: `${Math.max(3, (s.revenue / topRevenue) * 100)}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-muted">No orders yet.</p>
          )}
          <p className="mt-4 text-xs text-ink-muted">Add UTM tags (utm_source, utm_campaign) to ad and WhatsApp links so orders show their real source.</p>
        </Panel>

        <Panel icon={Rss} title="Product feeds" hint="Paste these links in the ad platforms">
          <ul className="space-y-2.5">
            {feeds.map((f) => (
              <li key={f.url} className="rounded-xl border border-line bg-subtle p-3">
                <p className="text-xs font-semibold text-ink">{f.name}</p>
                <div className="mt-1 flex items-center gap-1">
                  <code className="min-w-0 flex-1 truncate text-xs text-forest-fg">{f.url}</code>
                  <CopyButton value={f.url} label={`${f.name} feed link`} />
                  <a href={f.url} target="_blank" rel="noreferrer" aria-label={`Open ${f.name} feed`} className="grid size-7 place-items-center rounded-full text-ink-muted hover:bg-khaki-soft hover:text-forest-fg">
                    <ExternalLink className="size-3.5" />
                  </a>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel icon={Radio} title="Tracking setup" hint="Set in the server environment (.env / Hostinger). Browser tags load only after the shopper accepts cookies.">
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {TOOLS.map((t) => (
            <li key={t.name} className="flex items-center gap-3 rounded-xl border border-line bg-subtle px-3 py-2.5">
              {t.on ? <CheckCircle2 className="size-4 shrink-0 text-forest-fg" /> : <CircleDashed className="size-4 shrink-0 text-ink-muted" />}
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">{t.name}</p>
                <p className="text-xs text-ink-muted">{t.on ? t.hint : "Not connected"}</p>
              </div>
            </li>
          ))}
        </ul>
      </Panel>

      <OrdersBySource orders={sourcedOrders} onlyMarketing={onlyMarketing} />
    </div>
  );
}

function Panel({ icon: Icon, title, hint, children }: { icon: typeof Radio; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className={cn(card, "min-w-0 p-4 sm:p-5")}>
      <header className="mb-4 flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-khaki-soft text-forest-fg">
          <Icon className="size-4" />
        </span>
        <div>
          <h2 className="font-bold text-forest-text">{title}</h2>
          {hint && <p className="text-xs text-ink-muted">{hint}</p>}
        </div>
      </header>
      {children}
    </section>
  );
}

const KIND_STYLE: Record<MarketingOrder["kind"], string> = {
  ads: "bg-forest/10 text-forest-fg",
  campaign: "bg-khaki-soft text-forest-fg",
  search: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  social: "bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300",
  referral: "bg-subtle text-ink",
  direct: "bg-subtle text-ink-muted",
};

const pathOf = (url: string | null) => {
  if (!url) return null;
  try {
    const u = new URL(url, "https://x.invalid");
    return u.pathname === "/" ? "Home page" : u.pathname;
  } catch {
    return url;
  }
};

const hostOf = (url: string | null) => {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
};

/** Conversion event state for one order, in plain words. */
function EventState({ o }: { o: MarketingOrder }) {
  if (o.event)
    return (
      <span title={o.event.error ?? undefined} className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize", o.event.status === "sent" ? "bg-forest/10 text-forest-fg" : "bg-warm-strong text-sale")}>
        {o.event.status === "sent" ? "Sent to ads" : o.event.status}
        {o.event.attempts > 1 && ` · ${o.event.attempts} tries`}
      </span>
    );
  return <span className="text-[11px] text-ink-muted">{o.consent ? "Not sent" : "No consent"}</span>;
}

/** Each order with where it came from (ad click, campaign tags, referrer), newest first. */
function OrdersBySource({ orders, onlyMarketing }: { orders: MarketingOrder[]; onlyMarketing: boolean }) {
  const tab = (on: boolean) => cn("rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors", on ? "bg-forest text-white" : "text-ink-muted hover:text-ink");
  return (
    <section className={cn(card, "min-w-0 p-4 sm:p-5")}>
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-khaki-soft text-forest-fg">
            <Megaphone className="size-4" />
          </span>
          <div>
            <h2 className="font-bold text-forest-text">Orders and where they came from</h2>
            <p className="text-xs text-ink-muted">Newest first. Ad clicks, campaign tags (UTM), the page they landed on, and whether the sale was reported to Meta / Google.</p>
          </div>
        </div>
        <nav className="flex rounded-full border border-line p-1" aria-label="Filter orders">
          <Link href="/admin/marketing" scroll={false} className={tab(!onlyMarketing)}>All orders</Link>
          <Link href="/admin/marketing?show=marketing" scroll={false} className={tab(onlyMarketing)}>From marketing</Link>
        </nav>
      </header>

      {!orders.length ? (
        <p className="py-6 text-center text-sm text-ink-muted">
          {onlyMarketing ? "No orders from ads or campaign links yet. Add UTM tags to your ad and WhatsApp links so they show up here." : "No orders yet."}
        </p>
      ) : (
        <>
          {/* Desktop: table */}
          <div className="-mx-4 hidden overflow-x-auto sm:-mx-5 md:block">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-ink-muted">
                  <th className="px-5 py-2 font-medium">Order</th>
                  <th className="px-3 py-2 font-medium">Source</th>
                  <th className="px-3 py-2 font-medium">Campaign details</th>
                  <th className="px-3 py-2 font-medium">Landed on</th>
                  <th className="px-3 py-2 text-right font-medium">Amount</th>
                  <th className="px-5 py-2 text-right font-medium">Ad event</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {orders.map((o) => (
                  <tr key={o.id} className="relative align-top hover:bg-subtle">
                    <td className="px-5 py-3">
                      <Link href={`/admin/orders/view?id=${o.id}`} className="font-mono text-[13px] font-semibold text-forest-fg after:absolute after:inset-0">
                        {o.orderNo}
                      </Link>
                      <p className="text-xs text-ink">{o.customer || "Guest"}</p>
                      <p className="text-[11px] text-ink-muted">{when(o.createdAt)} · {o.method === "cod" ? "COD" : "Prepaid"}</p>
                    </td>
                    <td className="px-3 py-3">
                      <span className={cn("inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold", KIND_STYLE[o.kind])}>{o.channel}</span>
                      {o.medium && <p className="mt-1 text-[11px] text-ink-muted">{o.medium}</p>}
                    </td>
                    <td className="max-w-[220px] px-3 py-3 text-xs">
                      {o.campaign || o.content || o.term ? (
                        <dl className="space-y-0.5">
                          {o.campaign && <Detail k="Campaign" v={o.campaign} />}
                          {o.content && <Detail k="Ad" v={o.content} />}
                          {o.term && <Detail k="Keyword" v={o.term} />}
                        </dl>
                      ) : (
                        <span className="text-ink-muted">{o.kind === "direct" ? "-" : hostOf(o.referrer) ?? "-"}</span>
                      )}
                    </td>
                    <td className="max-w-[200px] truncate px-3 py-3 text-xs text-ink" title={o.landingPage ?? undefined}>{pathOf(o.landingPage) ?? <span className="text-ink-muted">-</span>}</td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums text-ink">{formatMoney(o.total)}</td>
                    <td className="px-5 py-3 text-right"><EventState o={o} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Phones: cards */}
          <ul className="-mx-4 divide-y divide-line md:hidden">
            {orders.map((o) => (
              <li key={o.id} className="relative px-4 py-3">
                <div className="flex items-baseline justify-between gap-2">
                  <Link href={`/admin/orders/view?id=${o.id}`} className="font-mono text-[13px] font-semibold text-forest-fg after:absolute after:inset-0">{o.orderNo}</Link>
                  <span className="font-semibold tabular-nums text-ink">{formatMoney(o.total)}</span>
                </div>
                <p className="text-xs text-ink-muted">{o.customer || "Guest"} · {when(o.createdAt)}</p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", KIND_STYLE[o.kind])}>{o.channel}</span>
                  {o.campaign && <span className="truncate text-xs text-ink">{o.campaign}</span>}
                  <span className="ml-auto"><EventState o={o} /></span>
                </div>
                {o.landingPage && <p className="mt-1 truncate text-[11px] text-ink-muted">Landed on {pathOf(o.landingPage)}</p>}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function Detail({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-1.5">
      <dt className="shrink-0 text-ink-muted">{k}</dt>
      <dd className="truncate text-ink" title={v}>{v}</dd>
    </div>
  );
}
