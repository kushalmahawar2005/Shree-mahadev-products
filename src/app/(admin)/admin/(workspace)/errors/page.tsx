import { connection } from "next/server";
import { Suspense } from "react";
import { RoleGate } from "@/components/admin/RoleGate";
import { ErrorsWorkspace } from "@/components/admin/ErrorsWorkspace";
import { listErrors } from "@/lib/server/error-log";

export const metadata = { title: "Errors" };

export default function ErrorsPage({ searchParams }: PageProps<"/admin/errors">) {
  return (
    <RoleGate roles={["owner", "manager"]}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-forest-text">Errors</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Problems the website hit (server and shoppers&apos; browsers), grouped so a repeating error is one row. A new kind of error also emails the store alert address.
          </p>
        </div>
        <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-surface" />}>
          <ErrorsList searchParams={searchParams} />
        </Suspense>
      </div>
    </RoleGate>
  );
}

async function ErrorsList({ searchParams }: { searchParams: PageProps<"/admin/errors">["searchParams"] }) {
  await connection();
  const show = (await searchParams).show === "all" ? "all" : "open";
  const rows = await listErrors(show).catch((e) => {
    console.error("listErrors", e);
    return null;
  });
  if (!rows) return <p className="rounded-2xl border border-line bg-surface p-6 text-sm text-ink-muted">Couldn&apos;t load errors. Is migration 039 applied?</p>;
  return <ErrorsWorkspace rows={rows} show={show} />;
}
