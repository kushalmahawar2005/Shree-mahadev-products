import { Suspense } from "react";
import { connection } from "next/server";
import { StoryEditor } from "@/components/admin/StoryEditor";
import { Skeleton } from "@/components/shadcn/skeleton";
import { DEFAULT_STORIES } from "@/data/pdp-story";
import { requireRole } from "@/lib/server/admin-auth";
import { readStoryOverrides } from "@/lib/server/pdp-story";
import { getProducts } from "@/lib/commerce";

export const metadata = { title: "Product page content" };
export const instant = false;

export default function ProductStoriesPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[480px] rounded-2xl" />}>
      <Data />
    </Suspense>
  );
}

async function Data() {
  await requireRole("owner", "manager");
  await connection();
  const [saved, products] = await Promise.all([readStoryOverrides(), getProducts()]);
  const info = (c: string) => {
    const list = products.filter((p) => p.category === c);
    return { count: list.length, href: list[0] ? `/products/${list[0].handle}` : "/shop" };
  };
  return <StoryEditor defaults={DEFAULT_STORIES} saved={saved} cats={{ oil: info("oil"), honey: info("honey"), sweetener: info("sweetener") }} />;
}
