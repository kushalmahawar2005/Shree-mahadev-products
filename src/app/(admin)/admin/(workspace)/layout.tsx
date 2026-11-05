import { Suspense } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { requireAdmin } from "@/lib/server/admin-auth";
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
  return <AdminShell role={role}>{children}</AdminShell>;
}

function AdminWorkspaceLoading() {
  return (
    <div className="flex min-h-dvh bg-[#f7f6f1]" aria-label="Loading admin workspace">
      <div className="hidden w-[250px] shrink-0 animate-pulse bg-[#082f20] lg:block" />
      <div className="min-w-0 flex-1">
        <div className="h-[68px] animate-pulse border-b border-line bg-white" />
        <div className="space-y-4 p-5 sm:p-8">
          <div className="h-9 w-56 animate-pulse rounded-lg bg-white" />
          <div className="h-24 animate-pulse rounded-2xl bg-white" />
          <div className="h-80 animate-pulse rounded-2xl bg-white" />
        </div>
      </div>
    </div>
  );
}
