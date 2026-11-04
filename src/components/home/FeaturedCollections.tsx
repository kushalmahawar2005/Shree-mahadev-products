import Image from "next/image";
import Link from "next/link";
import type { Collection } from "@/lib/commerce";
import { Container } from "@/components/ui/primitives";

export function FeaturedCollections({ collections }: { collections: Omit<Collection, "products">[] }) {
  if (!collections.length) return null;
  return (
    <section className="bg-khaki-soft py-12 md:py-16">
      <Container>
        <div className="mb-7 flex items-end justify-between gap-4">
          <div><h2 className="font-display text-3xl text-forest-text md:text-4xl">Shop our collections</h2><p className="mt-2 max-w-xl text-ink-muted">Explore the range by what you need in your kitchen.</p></div>
          <Link href="/shop" className="hidden min-h-11 items-center font-semibold text-forest underline-offset-4 hover:underline sm:inline-flex">Shop all products →</Link>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {collections.map((collection) => <li key={collection.handle}>
            <Link href={`/collections/${collection.handle}`} className="group block overflow-hidden rounded-2xl border border-line bg-white transition-shadow duration-200 hover:shadow-md">
              <div className="relative aspect-[16/9] overflow-hidden bg-khaki">
                {collection.image?.url && <Image src={collection.image.url} alt={collection.image.alt || collection.title} fill sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" className="object-cover transition-transform duration-500 group-hover:scale-[1.03]" />}
              </div>
              <div className="p-5"><h3 className="font-display text-2xl text-forest-text">{collection.title}</h3><p className="mt-2 line-clamp-2 text-sm leading-6 text-ink-muted">{collection.description}</p><span className="mt-4 inline-flex min-h-11 items-center font-semibold text-forest">Explore collection <span aria-hidden className="ml-2">→</span></span></div>
            </Link>
          </li>)}
        </ul>
        <Link href="/shop" className="mt-5 inline-flex min-h-11 items-center font-semibold text-forest underline-offset-4 hover:underline sm:hidden">Shop all products →</Link>
      </Container>
    </section>
  );
}
