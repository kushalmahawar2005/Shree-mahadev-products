import { AdminShell } from "@/components/admin/AdminShell";

/** Protected by src/proxy.ts (signed session cookie); login at /admin/login. */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
