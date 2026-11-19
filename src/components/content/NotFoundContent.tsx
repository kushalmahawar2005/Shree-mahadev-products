import Link from "next/link";
import { buttonClass } from "@/components/ui/Button";
import { Container } from "@/components/ui/primitives";
import { site } from "@/data/site";

/** Branded 404 body, used by both (site)/not-found.tsx and app/global-not-found.tsx. */
export function NotFoundContent() {
  return (
    <Container className="max-w-2xl py-16 text-center md:py-24">
      <p className="text-sm font-semibold text-mustard">Page not found</p>
      <h1 className="mt-2 text-4xl text-forest-text md:text-5xl">This page has gone missing</h1>
      <p className="mt-4 text-lg text-ink-muted">The link may be old or mistyped. Search for what you need, or pick up where most people start.</p>

      <form action="/search" role="search" className="mx-auto mt-8 flex max-w-md gap-2">
        <label htmlFor="nf-search" className="sr-only">
          Search products
        </label>
        <input
          id="nf-search"
          name="q"
          type="search"
          placeholder="Search for groundnut oil"
          className="min-h-12 flex-1 rounded-full border border-line bg-white px-5 text-base focus:border-forest focus:outline-none"
        />
        <button type="submit" className={buttonClass("primary", "lg")}>
          Search
        </button>
      </form>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/collections/wood-pressed-oils" className={buttonClass("secondary", "lg")}>
          Shop oils
        </Link>
        <Link href="/collections/raw-honey" className={buttonClass("secondary", "lg")}>
          Raw honey
        </Link>
        <Link href="/contact" className={buttonClass("secondary", "lg")}>
          Contact us
        </Link>
      </div>
      <p className="mt-8 text-sm text-ink-muted">
        Need help? <a className="font-semibold text-forest underline" href="/contact">Contact us</a> ({site.supportHours}).
      </p>
    </Container>
  );
}
