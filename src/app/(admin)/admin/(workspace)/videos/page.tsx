import { RoleGate } from "@/components/admin/RoleGate";
import { connection } from "next/server";
import { Suspense } from "react";
import { ReelManager, type PlaceInfo } from "@/components/admin/media/ReelManager";
import { brandFilm } from "@/data/home";
import { getProducts } from "@/lib/commerce";
import { getSetting, listReels } from "@/lib/server/videos";

export const metadata = { title: "Reels" };

export default function VideosPage() {
  return (
    <RoleGate roles={["owner", "manager"]}>
    <>
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-forest-text">Reels</h1>
        <p className="mt-1 text-sm text-ink-muted">All reels in one place. Tick where each one should show: the home page, or the product pages of a category.</p>
      </div>
      <Suspense fallback={<p className="text-ink-muted">Loading reels…</p>}>
        <Videos />
      </Suspense>
    </>
    </RoleGate>
  );
}

async function Videos() {
  await connection();
  const data = await Promise.all([listReels(), getSetting<string>("brand_film_youtube", brandFilm.youtube), getProducts()]).catch(
    (e) => (console.error(e), null),
  );
  if (!data) return <p className="text-sale">Could not connect to the database. Check DATABASE_* env vars.</p>;
  const [reels, youtube, products] = data;
  const of = (c: string) => products.filter((p) => p.category === c);
  const place = (id: "oil" | "honey" | "sweetener", label: string, short: string): PlaceInfo => {
    const list = of(id);
    return {
      id,
      label: `${label} (${list.length} products)`,
      short,
      href: list[0] ? `/products/${list[0].handle}` : "/shop",
      note: "Showing our built-in ghani clips",
    };
  };
  const places: PlaceInfo[] = [
    { id: "home", label: "Home page", short: "Home", href: "/", note: "Showing our built-in ghani clips" },
    place("oil", "Oil product pages", "Oils"),
    place("honey", "Honey product pages", "Honey"),
    place("sweetener", "Jaggery & khand pages", "Jaggery"),
  ];
  const tagged = reels.find((r) => r.placements.includes("product") && r.productHandle);
  places.push({
    id: "product",
    label: "Its product page (near Add to cart)",
    short: "Product",
    href: tagged ? `/products/${tagged.productHandle}` : "/shop",
    note: "Tag a product on the reel, then tick this",
  });
  places[2].note = "No reels section until you add one";
  places[3].note = "No reels section until you add one";
  return <ReelManager initial={reels} youtube={youtube} places={places} products={products.map((p) => ({ handle: p.handle, title: p.title }))} />;
}
export const instant = false;
