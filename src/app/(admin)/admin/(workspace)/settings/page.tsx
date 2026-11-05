import { connection } from "next/server";
import { Suspense } from "react";
import { SettingsForm } from "@/components/admin/SettingsForm";
import { getStoreSettings } from "@/lib/server/store-settings";
import { requireRole } from "@/lib/server/admin-auth";
import { mailConfigured } from "@/lib/server/mail";
import { nimbusConfigured } from "@/lib/server/nimbuspost";
import { payuConfigured } from "@/lib/server/payu";

export const metadata = { title: "Store settings" };
export const instant = false;

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-forest-text sm:text-3xl">Store settings</h1>
        <p className="mt-1 text-sm text-ink-muted">Business details, shipping and COD rules, announcement bar and social links.</p>
      </div>
      <Suspense fallback={<p className="text-sm text-ink-muted">Checking service configuration…</p>}>
        <Integrations />
      </Suspense>
      <Suspense fallback={<p className="text-ink-muted">Loading…</p>}>
        <Settings />
      </Suspense>
    </div>
  );
}

async function Settings() {
  await connection();
  await requireRole("owner");
  return <SettingsForm initial={await getStoreSettings()} />;
}

async function Integrations() {
  await connection();
  const payuTestMode = payuConfigured() && process.env.PAYU_MODE !== "live";
  const integrations = [
    { name: "Online payments · PayU", ok: payuConfigured(), warning: payuTestMode, state: payuTestMode ? "Test mode" : "Live mode", keys: "PAYU_KEY · PAYU_SALT", note: payuTestMode ? "Test credentials are configured; real payments are not being captured." : "Live payment credentials are configured." },
    { name: "Order email · Resend", ok: mailConfigured(), warning: false, state: mailConfigured() ? "Configured" : "Missing key", keys: "RESEND_API_KEY", note: "Without this key, order emails stay queued until delivery is configured." },
    { name: "Courier rates · NimbusPost", ok: nimbusConfigured(), warning: false, state: nimbusConfigured() ? "Configured" : "Missing keys", keys: "NIMBUSPOST_API_KEY · NIMBUSPOST_API_SECRET", note: "Without these keys, checkout uses the configured flat shipping fee." },
  ];
  const missing = integrations.filter((integration) => !integration.ok).length;
  return (
    <section aria-labelledby="integration-title" className="rounded-2xl border border-line bg-surface p-4 shadow-[0_1px_2px_rgba(0,0,0,.04)] md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 id="integration-title" className="text-lg font-bold text-forest-text">Payments, email & delivery</h2><p className="mt-1 text-sm text-ink-muted">Configuration status for the services your storefront relies on.</p></div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${missing || payuTestMode ? "bg-warm-strong text-sale" : "bg-forest/10 text-forest-fg"}`}>{missing ? `${missing} need setup` : payuTestMode ? "PayU test mode" : "All configured"}</span>
      </div>
      <ul className="mt-4 grid gap-3 xl:grid-cols-3">
        {integrations.map((integration) => <li key={integration.name} className="rounded-xl border border-line bg-subtle p-4">
          <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-bold text-forest-text">{integration.name}</h3><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${integration.warning || !integration.ok ? "bg-alert-soft text-alert" : "bg-forest/10 text-forest-fg"}`}>{integration.state}</span></div>
          <p className="mt-2 text-xs leading-relaxed text-ink-muted">{integration.note}</p>
          <code className="mt-3 block break-words rounded-lg bg-surface px-2.5 py-2 text-[11px] font-medium text-forest-fg">{integration.keys}</code>
        </li>)}
      </ul>
      <p className="mt-4 border-t border-line pt-3 text-xs leading-relaxed text-ink-muted">For security, secret values are never displayed here. Add missing values to <code className="rounded bg-khaki-soft px-1 py-0.5">.env.local</code> for local development or your hosting environment, then restart the app.</p>
    </section>
  );
}
