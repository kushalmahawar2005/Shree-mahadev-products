"use client";

import Link from "next/link";
import { useEffect } from "react";
import { reportClientErrorAction } from "@/lib/error-actions";
import { buttonClass } from "@/components/ui/Button";
import { Container } from "@/components/ui/primitives";

/**
 * Storefront error boundary: something failed while rendering a page. Keeps the header, footer and
 * cart (it renders inside the site layout), offers a retry and a way to keep shopping or reach us.
 */
export default function SiteError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
    // Errors with a digest came from the server and are already logged there; report browser-only crashes.
    const e = error as { message?: string; stack?: string; digest?: string } | null;
    if (!e?.digest) void reportClientErrorAction({ message: String(e?.message ?? error).slice(0, 1000), path: window.location.pathname, stack: e?.stack?.slice(0, 4000) }).catch(() => {});
  }, [error]);
  const digest = (error as { digest?: string } | null)?.digest;
  return (
    <Container className="max-w-2xl py-16 text-center md:py-24">
      <p className="text-sm font-semibold text-mustard">Something went wrong</p>
      <h1 className="mt-2 text-4xl text-forest-text md:text-5xl">This page didn&apos;t load properly</h1>
      <p className="mt-4 text-lg text-ink-muted">
        It&apos;s on our side, not yours. Try again, or carry on shopping. Your cart is safe.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={() => retry()} className={buttonClass("primary", "lg")}>
          Try again
        </button>
        <Link href="/" className={buttonClass("secondary", "lg")}>
          Go to home
        </Link>
        <Link href="/cart" className={buttonClass("secondary", "lg")}>
          View cart
        </Link>
      </div>
      <p className="mt-8 text-sm text-ink-muted">
        Still stuck?{" "}
        <Link className="font-semibold text-forest underline" href="/contact">
          Contact us
        </Link>
        .
      </p>
      {digest && <p className="mt-3 text-xs text-ink-muted/70">Ref: {digest}</p>}
    </Container>
  );
}
