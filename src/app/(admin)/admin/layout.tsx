import { AdminShell } from "@/components/admin/AdminShell";

/** TODO(client): protect /admin (Shopify staff login or simple password gate) before going live. */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
