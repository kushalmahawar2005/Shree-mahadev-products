import { Suspense } from "react";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { requireAdmin, type AdminRole } from "@/lib/server/admin-auth";

/**
 * Server-side page guard for admin pages that only some roles may open (the sidebar hides them, but a
 * typed URL must be refused too). Server actions behind these pages check the role again themselves.
 */
export function RoleGate({ roles, children }: { roles: AdminRole[]; children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-surface" aria-label="Loading" />}>
      <Gate roles={roles}>{children}</Gate>
    </Suspense>
  );
}

async function Gate({ roles, children }: { roles: AdminRole[]; children: React.ReactNode }) {
  const admin = await requireAdmin();
  if (roles.includes(admin.role as AdminRole)) return <>{children}</>;
  return (
    <div className="mx-auto mt-10 max-w-md rounded-2xl border border-line bg-surface p-8 text-center shadow-sm">
      <span className="mx-auto grid size-12 place-items-center rounded-full bg-warm text-ink">
        <ShieldAlert className="size-6" />
      </span>
      <h1 className="mt-4 text-lg font-bold text-forest-text">You don&apos;t have access to this page</h1>
      <p className="mt-1 text-sm text-ink-muted">Ask the store owner or a manager if you need this.</p>
      <Link href="/admin" className="mt-5 inline-flex h-10 items-center rounded-full bg-forest px-5 text-sm font-semibold text-white hover:bg-forest-deep">
        Back to dashboard
      </Link>
    </div>
  );
}
