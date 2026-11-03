import type { Metadata } from "next";
import { ContentGrid } from "@/components/content/ArticleShell";
import { Container } from "@/components/ui/primitives";
import { content } from "@/content";
import { pageMetadata } from "@/lib/utils/seo";

export const metadata: Metadata = pageMetadata({
  title: "Recipes",
  description: "Everyday Indian cooking with wood-pressed oils, raw honey and desi sweeteners.",
  path: "/recipes",
});

export default function RecipesPage() {
  const items = [...content.recipes].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  return (
    <Container className="py-10 md:py-16">
      <h1 className="text-4xl text-forest-text md:text-5xl">Recipes</h1>
      <p className="mt-3 max-w-2xl text-lg text-ink-muted">Everyday Indian cooking with wood-pressed oils, raw honey and desi sweeteners.</p>
      <div className="mt-8">
        <ContentGrid base="/recipes" items={items} />
      </div>
    </Container>
  );
}
