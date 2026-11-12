import { CheckCircle2, CircleDashed, ExternalLink, Megaphone, Radio, Rss, ShieldCheck, ShoppingBag, Target } from "lucide-react";
import { CopyButton } from "@/components/admin/order/CopyButton";
import { StatTile } from "@/components/admin/ui";
import { requireRole } from "@/lib/server/admin-auth";
import { getMarketingSummary } from "@/lib/server/marketing-admin";
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

export default async function MarketingPage() {
  await requireRole("owner", "manager");
  const data = await getMarketingSummary();
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

      <Panel icon={Radio} title="Recent server events" hint="Conversion events sent to Meta / Google from the server">
        {!data.events.length ? (
          <p className="text-sm text-ink-muted">No server events yet. They appear after orders once Meta CAPI or GA4 server events are connected.</p>
        ) : (
          <ul className="-mx-4 divide-y divide-line sm:-mx-5">
            {data.events.map((e) => (
              <li key={e.id} className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
                <span className={cn("size-2 shrink-0 rounded-full", e.status === "sent" ? "bg-forest-fg" : "bg-sale")} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">{e.name}</p>
                  <p className="truncate font-mono text-[11px] text-ink-muted">{e.eventId}</p>
                  {e.error && e.status !== "sent" && <p className="truncate text-xs text-alert">{e.error}</p>}
                </div>
                <div className="text-right">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize",
                      e.status === "sent" ? "bg-forest/10 text-forest-fg" : "bg-warm-strong text-sale",
                    )}
                  >
                    {e.status}
                    {e.attempts > 1 && ` · ${e.attempts} tries`}
                  </span>
                  <p className="mt-0.5 text-[11px] text-ink-muted">{when(e.createdAt)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
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
