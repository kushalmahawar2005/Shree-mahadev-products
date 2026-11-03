import type { Metadata } from "next";
import { NotFoundContent } from "@/components/content/NotFoundContent";

export const metadata: Metadata = { title: "Page not found", robots: { index: false } };

/** notFound() inside the storefront (missing product, collection, post). Renders inside the site layout. */
export default function NotFound() {
  return <NotFoundContent />;
}
