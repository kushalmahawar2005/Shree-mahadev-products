import { connection } from "next/server";
import { Suspense } from "react";
import { CollectionWorkspace } from "@/components/admin/CollectionWorkspace";
import { PageHeader } from "@/components/admin/ui";
import { listAdminCollections } from "@/lib/server/collections";

export const metadata = { title: "Collections" };

export default function CollectionsPage() {
  return <Suspense fallback={<><PageHeader title="Collections" intro="Manage collection pages, menus, and products." /><p className="text-ink-muted">Loading collections…</p></>}><Content /></Suspense>;
}

async function Content() {
  await connection();
  let rows;
  try { rows = await listAdminCollections(); }
  catch (e) { console.error(e); return <p className="text-sale">Could not load collections. Check the database connection.</p>; }
  return <CollectionWorkspace initialRows={rows} />;
}
