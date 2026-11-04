import { connection } from "next/server";
import { Suspense } from "react";
import { InventoryTable } from "@/components/admin/InventoryTable";
import { PageHeader } from "@/components/admin/ui";
import { listInventory, releaseExpiredHolds } from "@/lib/server/inventory";
import { getSetting } from "@/lib/server/videos";

export const metadata = { title: "Inventory" };

export default function InventoryPage() {
  return (
    <>
      <PageHeader
        title="Inventory"
        intro="Stock per size. Orders take stock automatically; cancelled orders and unpaid online orders give it back. Every change is logged."
      />
      <Suspense fallback={<p className="text-ink-muted">Loading stock…</p>}>
        <Inventory />
      </Suspense>
    </>
  );
}

async function Inventory() {
  await connection();
  await releaseExpiredHolds().catch((e) => console.error(e));
  const data = await Promise.all([listInventory(), getSetting<number>("low_stock_threshold", 5)]).catch((e) => (console.error(e), null));
  if (!data) return <p className="text-sale">Could not connect to the database. Check DATABASE_* env vars.</p>;
  const [rows, threshold] = data;
  return <InventoryTable rows={rows} threshold={Number(threshold) || 5} />;
}
