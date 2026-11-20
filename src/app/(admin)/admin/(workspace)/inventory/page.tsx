import { RoleGate } from "@/components/admin/RoleGate";
import { connection } from "next/server";
import { Suspense } from "react";
import { InventoryTable } from "@/components/admin/InventoryTable";
import { Skeleton } from "@/components/shadcn/skeleton";
import { listInventory, releaseExpiredHolds } from "@/lib/server/inventory";
import { getSetting } from "@/lib/server/videos";

export const metadata = { title: "Inventory" };

export default function InventoryPage() {
  return (
    <RoleGate roles={["owner", "manager"]}>
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-forest-text">Inventory</h1>
        <p className="mt-1 text-sm text-ink-muted">Stock per size. Orders take stock automatically; cancelled and unpaid orders give it back. Every change is logged.</p>
      </div>
      <Suspense fallback={<InventorySkeleton />}>
        <Inventory />
      </Suspense>
    </div>
    </RoleGate>
  );
}

async function Inventory() {
  await connection();
  await releaseExpiredHolds().catch((e) => console.error(e));
  const data = await Promise.all([listInventory(), getSetting<number>("low_stock_threshold", 5)]).catch((e) => (console.error(e), null));
  if (!data) return <p className="text-sale">Could not connect to the database. Check DATABASE_* env vars.</p>;
  const [rows, threshold] = data;
  const savedThreshold = Number(threshold);
  return <InventoryTable rows={rows} threshold={Number.isFinite(savedThreshold) ? savedThreshold : 5} />;
}
function InventorySkeleton() {
  return (
    <div className="space-y-5" aria-label="Loading stock">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-20 rounded-2xl bg-surface" />
        ))}
      </div>
      <Skeleton className="h-10 rounded-full bg-surface" />
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className="h-40 rounded-2xl bg-surface" />
      ))}
    </div>
  );
}
export const instant = false;
