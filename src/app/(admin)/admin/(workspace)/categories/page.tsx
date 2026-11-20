import { RoleGate } from "@/components/admin/RoleGate";
import { connection } from "next/server";
import { Suspense } from "react";
import { CollectionWorkspace } from "@/components/admin/CollectionWorkspace";
import { Skeleton } from "@/components/shadcn/skeleton";
import { listAdminCollections } from "@/lib/server/collections";

export const metadata = { title: "Collections" };

export default function CollectionsPage() {
  return (
    <RoleGate roles={["owner", "manager"]}>
    <Suspense
      fallback={
        <div className="space-y-6" aria-label="Loading collections">
          <Skeleton className="h-10 w-64 bg-surface" />
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-20 rounded-2xl bg-surface" />)}
          </div>
          <Skeleton className="h-96 rounded-2xl bg-surface" />
        </div>
      }
    >
      <Content />
    </Suspense>
    </RoleGate>
  );
}

async function Content() {
  await connection();
  let rows;
  try { rows = await listAdminCollections(); }
  catch (e) { console.error(e); return <p className="text-sale">Could not load collections. Check the database connection.</p>; }
  return <CollectionWorkspace initialRows={rows} />;
}
export const instant = false;
