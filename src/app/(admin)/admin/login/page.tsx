import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/admin/LoginForm";

export const metadata: Metadata = { title: "Log in", robots: { index: false, follow: false } };

export default function AdminLoginPage({ searchParams }: PageProps<"/admin/login">) {
  return (
    <div className="relative grid min-h-svh place-items-center overflow-hidden bg-forest-deep px-4 py-10">
      {/* Soft brand glow, decorative */}
      <div aria-hidden className="pointer-events-none absolute -top-40 -right-40 size-[520px] rounded-full bg-mustard/20 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-48 -left-40 size-[520px] rounded-full bg-khaki/15 blur-3xl" />
      <Suspense>
        <LoginForm searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
export const instant = false;
