import { PickCard } from "@/components/home/PickCard";
import { toPickProduct } from "@/components/home/pickProduct";
import type { Product } from "@/lib/commerce/types";

/** Shoppable products used in a recipe / mentioned in a post. */
export function MadeWith({ title, products }: { title: string; products: Product[] }) {
  return (
    <section className="mt-10">
      <h2 className="mb-4 text-2xl">{title}</h2>
      <ul className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-3">
        {products.map((p) => (
          <li key={p.handle}>
            <PickCard product={toPickProduct(p)} />
          </li>
        ))}
      </ul>
    </section>
  );
}
