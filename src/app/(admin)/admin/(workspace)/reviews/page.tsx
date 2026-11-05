import { Suspense } from "react";
import { connection } from "next/server";
import { ReviewsWorkspace } from "@/components/admin/ReviewsWorkspace";
import { loadProducts } from "@/lib/server/catalog";
import { listAdminReviews } from "@/lib/server/reviews";

export const metadata = { title: "Reviews" };
export const instant = false;

export default function ReviewsPage() {
  return (
      <Suspense fallback={<p className="text-ink-muted">Loading reviews…</p>}>
        <ReviewData />
      </Suspense>
  );
}

async function ReviewData() {
  await connection();
  const [pending, approved, rejected, products] = await Promise.all([
    listAdminReviews("pending"),
    listAdminReviews("approved"),
    listAdminReviews("rejected"),
    loadProducts({ status: "active" }),
  ]);
  return (
    <ReviewsWorkspace
      pending={pending}
      approved={approved}
      rejected={rejected}
      products={products.map((p) => ({ handle: p.handle, title: p.title }))}
    />
  );
}
