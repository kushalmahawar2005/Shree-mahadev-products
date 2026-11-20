import { RoleGate } from "@/components/admin/RoleGate";
import { connection } from "next/server";
import { Suspense } from "react";
import { BannerManager } from "@/components/admin/media/BannerManager";
import { listBanners } from "@/lib/server/media";

export const metadata = { title: "Home banners" };

export default function BannersPage() {
  return (
    <RoleGate roles={["owner", "manager"]}>
      <Suspense fallback={<p className="text-ink-muted">Loading slides…</p>}>
        <Banners />
      </Suspense>
    </RoleGate>
  );
}

async function Banners() {
  await connection();
  const banners = await listBanners().catch((e) => (console.error(e), null));
  if (!banners) return <p className="text-sale">Could not connect to the database. Check DATABASE_* env vars.</p>;
  return <BannerManager initial={banners} />;
}
export const instant = false;
