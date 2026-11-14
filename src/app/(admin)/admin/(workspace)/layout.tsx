import { Suspense } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { requireAdmin } from "@/lib/server/admin-auth";
import { helpdeskOpenCount } from "@/lib/server/helpdesk";
import { connection } from "next/server";

/** Protected admin workspace. Login lives outside this route group so its public layout is never cached here. */
export default function AdminWorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<AdminWorkspaceLoading />}>
      <AuthenticatedAdminWorkspace>{children}</AuthenticatedAdminWorkspace>
    </Suspense>
  );
}

async function AuthenticatedAdminWorkspace({ children }: { children: React.ReactNode }) {
  await connection();
  const admin = await requireAdmin();
  const role =
    admin.role === "manager" || admin.role === "staff" ? admin.role : "owner";
  const helpdesk = await helpdeskOpenCount().catch(() => 0);
  return (
    <AdminShell role={role} username={admin.username} badges={{ "/admin/helpdesk": helpdesk }}>
      {children}
    </AdminShell>
  );
}

function AdminWorkspaceLoading() {
  return (
    <div className="flex min-h-dvh bg-canvas" aria-label="Loading admin workspace">
      <div className="hidden w-64 shrink-0 animate-pulse bg-sidebar md:block" />
      <div className="min-w-0 flex-1">
        <div className="h-16 animate-pulse border-b border-line bg-surface" />
        <div className="space-y-4 p-5 sm:p-8">
          <div className="h-9 w-56 animate-pulse rounded-lg bg-surface" />
          <div className="h-24 animate-pulse rounded-2xl bg-surface" />
          <div className="h-80 animate-pulse rounded-2xl bg-surface" />
        </div>
      </div>
    </div>
  );
}
