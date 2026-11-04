import { requireAdmin } from "@/lib/server/admin-auth";
import { getMarketingSummary } from "@/lib/server/marketing-admin";
import { formatMoney } from "@/lib/utils/money";
import { Card, PageHeader, StatusBadge } from "@/components/admin/ui";

export const metadata = { title: "Marketing" };
export const instant = false;

export default async function MarketingPage() {
  await requireAdmin();
  const data = await getMarketingSummary();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://your-domain.example";
  return (
    <>
      <PageHeader title="Marketing" intro="Campaign attribution, product feeds, and server-side event delivery." />
      <div className="grid gap-4 md:grid-cols-3">
        <Card><p className="text-sm text-ink-muted">Orders</p><p className="mt-1 text-3xl font-semibold">{data.counts.orders}</p></Card>
        <Card><p className="text-sm text-ink-muted">With marketing consent</p><p className="mt-1 text-3xl font-semibold">{data.counts.consented}</p></Card>
        <Card><p className="text-sm text-ink-muted">Attributed orders</p><p className="mt-1 text-3xl font-semibold">{data.counts.attributed}</p></Card>
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="text-lg font-semibold text-forest-text">Product feeds</h2>
          <p className="mt-2 text-sm text-ink-muted">Submit these public URLs to Google Merchant Center and Meta Commerce Manager.</p>
          <ul className="mt-4 space-y-3 text-sm">
            <li><strong>Google:</strong> <a className="break-all text-forest underline" href={`${siteUrl}/feeds/google.xml`}>{siteUrl}/feeds/google.xml</a></li>
            <li><strong>Meta:</strong> <a className="break-all text-forest underline" href={`${siteUrl}/feeds/meta.xml`}>{siteUrl}/feeds/meta.xml</a></li>
          </ul>
        </Card>
        <Card>
          <h2 className="text-lg font-semibold text-forest-text">Orders by source</h2>
          <ul className="mt-3 divide-y divide-line">
            {data.sources.length ? data.sources.map((row) => <li key={row.source} className="flex justify-between gap-4 py-2 text-sm"><span>{row.source} <span className="text-ink-muted">({row.orders})</span></span><strong>{formatMoney(row.revenue)}</strong></li>) : <li className="py-2 text-sm text-ink-muted">No attributed orders yet.</li>}
          </ul>
        </Card>
      </div>
      <Card className="mt-6">
        <h2 className="text-lg font-semibold text-forest-text">Recent server events</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[600px] text-left text-sm"><thead><tr className="border-b border-line text-ink-muted"><th className="py-2">Event</th><th>Event ID</th><th>Status</th><th>Attempts</th><th>Created</th></tr></thead><tbody>{data.events.map((row) => <tr key={row.id} className="border-b border-line"><td className="py-2">{row.name}</td><td className="max-w-40 truncate">{row.eventId}</td><td><StatusBadge tone={row.status === "sent" ? "green" : "amber"}>{row.status}</StatusBadge></td><td>{row.attempts}</td><td>{row.createdAt}</td></tr>)}</tbody></table>
        </div>
      </Card>
    </>
  );
}
