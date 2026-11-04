import { requireRole } from "@/lib/server/admin-auth";
import { listAdminUsers } from "@/lib/server/admin-users";
import { AdminUsersWorkspace } from "@/components/admin/AdminUsersWorkspace";

export const metadata = { title: "Admin users" };
export const instant = false;

export default async function AdminUsersPage() {
  await requireRole("owner");
  return <AdminUsersWorkspace initialUsers={await listAdminUsers()} />;
}
