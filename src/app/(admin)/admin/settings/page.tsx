import { connection } from "next/server";
import { Suspense } from "react";
import { SettingsForm } from "@/components/admin/SettingsForm";
import { PageHeader } from "@/components/admin/ui";
import { getStoreSettings } from "@/lib/server/store-settings";

export const metadata = { title: "Store settings" };

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Store settings" intro="Business details, shipping and COD rules, announcement bar and social links." />
      <Suspense fallback={<p className="text-ink-muted">Loading…</p>}>
        <Settings />
      </Suspense>
    </>
  );
}

async function Settings() {
  await connection();
  return <SettingsForm initial={await getStoreSettings()} />;
}
