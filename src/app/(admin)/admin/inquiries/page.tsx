import { Suspense } from "react";
import { connection } from "next/server";
import { PageHeader } from "@/components/admin/ui";
import { InquiriesWorkspace } from "@/components/admin/InquiriesWorkspace";
import { loadProducts } from "@/lib/server/catalog";
import { listInquiries } from "@/lib/server/inquiries";
import { db } from "@/lib/server/db";
import type { RowDataPacket } from "mysql2/promise";

export const metadata = { title: "Bulk inquiries" };

export default function InquiriesPage({
  searchParams,
}: PageProps<"/admin/inquiries">) {
  return (
    <>
      <PageHeader
        title="Bulk inquiries"
        intro="Track wholesale leads, follow-ups and quotes in one place."
      />
      <Suspense fallback={<p className="text-ink-muted">Loading inquiries…</p>}>
        <InquiryData searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function InquiryData({
  searchParams,
}: {
  searchParams: PageProps<"/admin/inquiries">["searchParams"];
}) {
  await connection();
  const [params, inquiries, products] = await Promise.all([
    searchParams,
    listInquiries(),
    loadProducts({ status: "active" }),
  ]);
  const [[todayRow]] = await db().query<RowDataPacket[]>(
    "SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS today",
  );
  const variants = products.flatMap((product) =>
    product.variants
      .filter((variant) => variant.availableForSale)
      .map((variant) => ({
        variantKey: variant.id,
        title: `${product.title} · ${variant.title}`,
        price: variant.price.amount,
      })),
  );
  return (
    <InquiriesWorkspace
      initialInquiries={inquiries}
      variants={variants}
      initialFilter={params.f === "due" ? "due" : "all"}
      today={todayRow.today}
    />
  );
}
export const instant = false;
