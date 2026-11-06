import type { Metadata } from "next";
import { ContentGrid } from "@/components/content/ArticleShell";
import { content } from "@/content";
import { pageMetadata } from "@/lib/utils/seo";

export const metadata: Metadata = pageMetadata({
  title: "Recipes",
  description:
    "Everyday Indian cooking with wood-pressed oils, raw honey and desi sweeteners.",
  path: "/recipes",
});

export default function RecipesPage() {
  const items = [...content.recipes].sort((a, b) =>
    (b.date ?? "").localeCompare(a.date ?? ""),
  );
  return (
    <div className="bg-[#F5EDDE]">
      <div className="mx-auto max-w-[1200px] px-4 pt-8 pb-16 md:px-8 md:pt-12 md:pb-24">
        <p className="font-hindi text-lg text-sale" lang="hi">
          घर की रसोई से
        </p>
        <h1 className="text-3xl md:text-5xl">Recipes</h1>
        <p className="mt-3 max-w-2xl text-ink-muted md:text-lg">
          Everyday Indian cooking with wood-pressed oils, raw honey and desi
          sweeteners.
        </p>
        <div className="mt-8">
          <ContentGrid base="/recipes" items={items} />
        </div>
      </div>
    </div>
  );
}
