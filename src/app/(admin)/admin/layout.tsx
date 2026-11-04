import { AdminShell } from "@/components/admin/AdminShell";
import { requireAdmin } from "@/lib/server/admin-auth";
import { headers } from "next/headers";

/** Protected by src/proxy.ts (signed session cookie); login at /admin/login. */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminLayoutContent>{children}</AdminLayoutContent>;
}

async function AdminLayoutContent({ children }: { children: React.ReactNode }) {
  if ((await headers()).get("x-admin-public") === "1") return children;
  const admin = await requireAdmin();
  const role = admin.role === "manager" || admin.role === "staff" ? admin.role : "owner";
  return <AdminShell role={role}>{children}</AdminShell>;
}
