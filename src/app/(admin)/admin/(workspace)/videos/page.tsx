import { connection } from "next/server";
import { Suspense } from "react";
import { ReelManager } from "@/components/admin/media/ReelManager";
import { brandFilm } from "@/data/home";
import { getProducts } from "@/lib/commerce";
import { getSetting, listReels } from "@/lib/server/videos";

export const metadata = { title: "Videos" };

export default function VideosPage() {
  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-forest-text sm:text-3xl">Videos</h1>
        <p className="mt-1 text-sm text-ink-muted">Homepage reels and the brand film. Changes go live right away.</p>
      </div>
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
