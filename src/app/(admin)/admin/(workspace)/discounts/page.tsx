import { Suspense } from "react";
import { connection } from "next/server";
import { CouponsWorkspace } from "@/components/admin/CouponsWorkspace";
import { listCoupons } from "@/lib/server/coupons";
import { loadProducts } from "@/lib/server/catalog";
import { db } from "@/lib/server/db";
import type { RowDataPacket } from "mysql2/promise";

/** Page is dynamic (connection()), so this runs per request. */
const requestTime = () => Date.now();

export const metadata = { title: "Coupons" };

export default function DiscountsPage() {
  return (
      <Suspense fallback={<p className="text-ink-muted">Loading coupons…</p>}>
        <CouponData />
      </Suspense>
  );
}

async function CouponData() {
  await connection();
  const [coupons, products, collections] = await Promise.all([
    listCoupons(),
    loadProducts({ status: "active" }),
    db()
      .query<RowDataPacket[]>(
        "SELECT handle, title FROM collections WHERE active=1 ORDER BY sort_order, title",
      )
      .then(([rows]) => rows),
  ]);
  const now = requestTime();
  return (
    <CouponsWorkspace
      now={now}
      coupons={coupons}
      products={products.map((p) => ({ handle: p.handle, title: p.title }))}
      collections={collections.map((c) => ({
        handle: String(c.handle),
        title: String(c.title),
      }))}
    />
  );
}
export const instant = false;
