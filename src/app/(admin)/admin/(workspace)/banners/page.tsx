import { connection } from "next/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/admin/ui";
import { BannerManager } from "@/components/admin/media/BannerManager";
import { listBanners } from "@/lib/server/media";

export const metadata = { title: "Hero banners" };

export default function BannersPage() {
  return (
    <>
      <PageHeader title="Hero banners" intro="Homepage slider. Changes go live on the storefront immediately." />
      <Suspense fallback={<p className="text-ink-muted">Loading slides…</p>}>
        <Banners />
      </Suspense>
    </>
  );
}

async function Banners() {
  await connection();
  const banners = await listBanners().catch((e) => (console.error(e), null));
  if (!banners) return <p className="text-sale">Could not connect to the database. Check DATABASE_* env vars.</p>;
  return <BannerManager initial={banners} />;
}
export const instant = false;
