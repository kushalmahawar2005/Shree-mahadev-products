import { gatewayIsTest } from "@/lib/server/payment-gateway";
import { connection } from "next/server";
import { Suspense } from "react";
import { SettingsForm, type Integration } from "@/components/admin/SettingsForm";
import { Skeleton } from "@/components/shadcn/skeleton";
import { velocityConfigured } from "@/lib/server/velocity";
import { getStoreSettings } from "@/lib/server/store-settings";
import { requireRole } from "@/lib/server/admin-auth";
import { mailConfigured } from "@/lib/server/mail";
import { nimbusConfigured } from "@/lib/server/nimbuspost";
import { payuConfigured } from "@/lib/server/payu";
import { cashfreeConfigured, cashfreeMode } from "@/lib/server/cashfree";

export const metadata = { title: "Store settings" };
export const instant = false;

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-forest-text">Store settings</h1>
        <p className="mt-1 text-sm text-ink-muted">Payments, shipping and COD rules, the announcement bar, business details and social links.</p>
      </div>
      <Suspense fallback={<SettingsSkeleton />}>
        <Settings />
      </Suspense>
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <div className="grid gap-6 xl:grid-cols-[13rem_minmax(0,1fr)]">
      <div className="hidden space-y-2 xl:block">{Array.from({ length: 7 }, (_, i) => <Skeleton key={i} className="h-9 rounded-xl" />)}</div>
      <div className="space-y-5">{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-56 rounded-2xl" />)}</div>
    </div>
  );
}

async function Settings() {
  await connection();
  await requireRole("owner");
  const settings = await getStoreSettings();
  return (
    <SettingsForm
      initial={settings}
      gateways={{ payu: payuConfigured(), cashfree: cashfreeConfigured() }}
      testModes={{ payu: gatewayIsTest("payu"), cashfree: gatewayIsTest("cashfree") }}
      integrations={integrations(settings.paymentGateway === "cashfree")}
    />
  );
}

/** Status of the outside services the store relies on (env keys only; values never leave the server). */
function integrations(gatewayIsCashfree: boolean): Integration[] {
  const payuTestMode = payuConfigured() && process.env.PAYU_MODE !== "live";
  const couriers = [velocityConfigured() && "Velocity", nimbusConfigured() && "NimbusPost"].filter(Boolean) as string[];
  return [
    {
      name: "Cashfree payments",
      ok: cashfreeConfigured() || !gatewayIsCashfree,
      warning: cashfreeConfigured() && cashfreeMode() !== "production",
      state: !cashfreeConfigured() ? "Not set up" : cashfreeMode() === "production" ? "Live" : "Test mode",
      keys: "CASHFREE_APP_ID · CASHFREE_SECRET_KEY · CASHFREE_ENV",
      note: !cashfreeConfigured() ? "Add keys, then pick it under Online payments." : cashfreeMode() === "production" ? "Live keys: real payments are captured." : "Sandbox keys: payments are test-only.",
    },
    {
      name: "PayU payments",
      ok: payuConfigured() || gatewayIsCashfree,
      warning: payuTestMode && !gatewayIsCashfree,
      state: !payuConfigured() ? "Not set up" : payuTestMode ? "Test mode" : "Live",
      keys: "PAYU_KEY · PAYU_SALT · PAYU_MODE",
      note: payuTestMode ? (gatewayIsCashfree ? "Test keys. Not in use: checkout uses Cashfree." : "Test keys: real payments are not captured.") : "Live keys are configured.",
    },
    {
      name: "Order emails",
      ok: mailConfigured(),
      warning: false,
      state: mailConfigured() ? "Connected" : "Missing key",
      keys: "RESEND_API_KEY · SMTP_HOST/USER/PASS",
      note: "Resend sends first, SMTP is the backup. Without either, order emails wait in the queue.",
    },
    {
      name: "Courier partners",
      ok: couriers.length > 0,
      warning: false,
      state: couriers.length ? couriers.join(" + ") : "Missing keys",
      keys: "VELOCITY_* · NIMBUSPOST_API_KEY · NIMBUSPOST_API_SECRET",
      note: couriers.length ? "Live rates at checkout and shipment booking from the order page." : "Checkout uses the flat backup shipping fee.",
    },
  ];
}
