import type { Metadata } from "next";
import { ComparisonTable } from "@/components/home/ComparisonTable";
import { Reveal } from "@/components/motion/Reveal";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/shadcn/breadcrumb";
import { FactsStrip, FilmFrame, NeverDo, ProcessTimeline, StoryCta } from "@/components/story/StoryBits";
import { pageMetadata } from "@/lib/utils/seo";

export const metadata: Metadata = pageMetadata({
  title: "Our ghani: how we press our oil",
  description: "From seed to bottle: how our kachi ghani oil is slowly pressed in a wooden ghani in Bijainagar, Rajasthan.",
  path: "/our-ghani",
});

// TODO(client): the ghani itself (wood type, how many, who runs them, batch time) and seed sourcing.
// Add them as sections here once confirmed; nothing is invented meanwhile.

export default function OurGhaniPage() {
  return (
    <div className="bg-page">
      <div className="mx-auto max-w-[1200px] px-4 pt-6 pb-10 md:px-8 md:pt-8 md:pb-24">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/">Home</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Our ghani</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <section className="mt-6 text-center">
          <p className="font-hindi text-lg text-sale" lang="hi">
            लकड़ी की घानी
          </p>
          <h1 className="mx-auto max-w-3xl text-4xl leading-[1.05] md:text-6xl">Seed to bottle, slowly</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-ink-muted">
            A wooden ghani turns at a walking pace. It takes longer and gives less oil than a machine, but the oil stays cool and keeps the taste of the seed.
          </p>
        </section>

        <FilmFrame className="mt-8 aspect-[16/9] shadow-[0_40px_80px_-50px_rgba(7,47,27,0.8)] md:aspect-[21/9]" />

        <div className="mt-6">
          <FactsStrip />
        </div>

        <section className="mt-10 md:mt-14">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-sale uppercase">The process</p>
          <h2 className="mt-1 mb-6 text-3xl md:text-4xl">Four slow steps</h2>
          <ProcessTimeline />
        </section>

        <Reveal className="mt-10 md:mt-14 grid gap-8 rounded-3xl bg-forest p-6 text-white md:p-10 lg:grid-cols-[1fr_1.3fr] lg:items-center">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.18em] text-[#e8c879] uppercase">Kept out</p>
            <h2 className="mt-2 text-3xl text-white md:text-4xl">What we never do</h2>
          </div>
          <NeverDo />
        </Reveal>

        <Reveal className="mt-10 md:mt-14">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-sale uppercase">Side by side</p>
          <h2 className="mt-1 mb-6 text-3xl md:text-4xl">Kachi ghani vs refined</h2>
          <ComparisonTable />
        </Reveal>

        <div className="mt-10 md:mt-14">
          <StoryCta />
        </div>
      </div>
    </div>
  );
}
