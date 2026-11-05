import { connection } from "next/server";
import { Suspense } from "react";
import { ReelManager } from "@/components/admin/media/ReelManager";
import { PageHeader } from "@/components/admin/ui";
import { brandFilm } from "@/data/home";
import { getProducts } from "@/lib/commerce";
import { getSetting, listReels } from "@/lib/server/videos";

export const metadata = { title: "Videos" };

export default function VideosPage() {
  return (
    <>
      <PageHeader title="Videos" intro="Homepage reels and the brand film. Changes go live immediately." />
      <Suspense fallback={<p className="text-ink-muted">Loading videos…</p>}>
        <Videos />
      </Suspense>
    </>
  );
}

async function Videos() {
  await connection();
  const data = await Promise.all([listReels(), getSetting<string>("brand_film_youtube", brandFilm.youtube), getProducts()]).catch(
    (e) => (console.error(e), null),
  );
  if (!data) return <p className="text-sale">Could not connect to the database. Check DATABASE_* env vars.</p>;
  const [reels, youtube, products] = data;
  return <ReelManager initial={reels} youtube={youtube} products={products.map((p) => ({ handle: p.handle, title: p.title }))} />;
}
export const instant = false;
