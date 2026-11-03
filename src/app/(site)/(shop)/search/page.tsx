import type { Metadata } from "next";
import { Suspense } from "react";
import { ProductGrid } from "@/components/product/ProductGrid";
import { Container } from "@/components/ui/primitives";
import { searchProducts } from "@/lib/commerce";

export const metadata: Metadata = {
  title: "Search",
  description: "Search wood-pressed oils, raw honey and natural sweeteners.",
  alternates: { canonical: "/search" },
  robots: { index: false, follow: true },
};

export default function SearchPage({ searchParams }: PageProps<"/search">) {
  return (
    <Container className="py-10 md:py-14">
      <h1 className="text-4xl md:text-5xl">Search</h1>
      <Suspense fallback={<SearchForm />}>
        <Results searchParams={searchParams} />
      </Suspense>
    </Container>
  );
}

async function Results({ searchParams }: Pick<PageProps<"/search">, "searchParams">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 80) : "";
  const results = q ? await searchProducts(q) : [];
  return (
    <>
      <SearchForm q={q} />
      {q && (
        <p className="mt-6 text-ink-muted" aria-live="polite">
          {results.length} {results.length === 1 ? "result" : "results"} for &ldquo;{q}&rdquo;
        </p>
      )}
      {q && <ProductGrid products={results} className="mt-6" />}
    </>
  );
}

function SearchForm({ q = "" }: { q?: string }) {
  return (
    <form action="/search" role="search" className="mt-6 flex max-w-xl gap-2">
      <label htmlFor="q" className="sr-only">
        Search products
      </label>
      <input
        id="q"
        name="q"
        type="search"
        defaultValue={q}
        placeholder="Try mustard, honey, baby massage"
        autoFocus
        className="min-h-12 flex-1 rounded-full border border-line px-5 focus:border-forest focus:outline-none"
      />
      <button type="submit" className="min-h-12 rounded-full bg-forest px-6 font-semibold text-white hover:bg-forest-mid">
        Search
      </button>
    </form>
  );
}
