import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { AccountShell } from "@/components/account/AccountShell";
import { CardSkeleton } from "@/components/account/ui";
import { Skeleton } from "@/components/shadcn/skeleton";
import { getAccountShell } from "@/lib/server/account";

// Private, per-session pages: render on the server per request (nothing to prerender into a static shell).
export const instant = false;

/** Shared shell for every /account route. proxy.ts sends signed-out visitors to /login?next=…; this re-checks the session. */
export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="co-theme bg-page text-ink">
      <div className="mx-auto max-w-7xl px-4 pt-4 pb-12 md:px-6 lg:pt-10">
        <Suspense fallback={<ShellSkeleton />}>
          <Shell>{children}</Shell>
        </Suspense>
      </div>
    </div>
  );
}

async function Shell({ children }: { children: React.ReactNode }) {
  await connection();
  const data = await getAccountShell();
  if (!data) redirect("/login?next=/account");
  return <AccountShell data={data}>{children}</AccountShell>;
}

function ShellSkeleton() {
  return (
    <div className="grid gap-8 lg:grid-cols-12">
      <div className="hidden space-y-4 lg:col-span-4 lg:block">
        <Skeleton className="h-52 rounded-3xl" />
        <Skeleton className="h-72 rounded-3xl bg-white" />
      </div>
      <div className="space-y-4 lg:col-span-8">
        <Skeleton className="h-16 w-72" />
        <CardSkeleton rows={4} />
      </div>
    </div>
  );
}
