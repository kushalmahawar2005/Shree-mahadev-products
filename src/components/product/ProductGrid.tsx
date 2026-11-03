import { Stagger, StaggerItem } from "@/components/motion/Reveal";
import type { Product } from "@/lib/commerce/types";
import { cn } from "@/lib/utils/cn";
import { ProductCard } from "./ProductCard";
import { toCardProduct } from "./cardProduct";

export function ProductGrid({
  products,
  className,
  priorityCount = 0,
}: {
  products: Product[];
  className?: string;
  priorityCount?: number;
}) {
  if (!products.length) {
    return <p className="py-10 text-center text-ink-muted">No products here yet.</p>;
  }
  return (
    <Stagger as="ul" className={cn("grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4", className)}>
      {products.map((p, i) => (
        <StaggerItem as="li" key={p.handle}>
          <ProductCard product={toCardProduct(p)} priority={i < priorityCount} />
        </StaggerItem>
      ))}
    </Stagger>
  );
}
