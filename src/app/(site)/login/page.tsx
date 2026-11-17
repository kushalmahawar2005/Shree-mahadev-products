import type { Metadata } from "next";
import { safeInternalPath } from "@/lib/utils/safe-path";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { SignIn } from "@/components/customer/AccountWorkspace";
import { getCustomerSession } from "@/lib/server/customer-auth";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false },
};

/** Only same-site paths: never bounce a shopper to another domain after login. */
const safeNext = (v: unknown) => safeInternalPath(v, "/account");

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <div className="co-theme bg-page">
      <div className="mx-auto max-w-4xl px-4 py-10 md:py-12">
        <div className="mb-8 text-center">
          <p className="font-hindi text-lg text-co-accent-ink" lang="hi">
            मेरा खाता
          </p>
          <h1 className="text-3xl text-ink md:text-5xl">Sign in</h1>
        </div>
        <Suspense>
          <LoginContent searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}

async function LoginContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const next = safeNext((await searchParams).next);
  if (await getCustomerSession()) redirect(next);
  return <SignIn next={next} />;
}
