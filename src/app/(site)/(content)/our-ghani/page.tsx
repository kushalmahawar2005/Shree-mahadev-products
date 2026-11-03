import type { Metadata } from "next";
import { ComparisonTable } from "@/components/home/ComparisonTable";
import { ProcessSteps } from "@/components/home/ProcessSteps";
import { Reveal } from "@/components/motion/Reveal";
import { LinkButton } from "@/components/ui/Button";
import { Container } from "@/components/ui/primitives";
import { pageMetadata } from "@/lib/utils/seo";

export const metadata: Metadata = pageMetadata({
  title: "Our ghani: how we press our oil",
  description:
    "From seed to bottle: how our kachi ghani oil is slowly pressed in a wooden ghani in Bijainagar, Rajasthan.",
  path: "/our-ghani",
});

export default function OurGhaniPage() {
  return (
    <>
      <section className="bg-khaki-soft py-14 md:py-20">
        <Container className="max-w-3xl">
          <p className="font-display text-2xl text-mustard" lang="hi">
            लकड़ी की घानी
          </p>
          <h1 className="mt-2 text-4xl md:text-5xl">Seed to bottle, slowly</h1>
          <p className="mt-5 text-lg text-ink-muted">
            A wooden ghani turns at a walking pace. It takes longer and gives less oil than a machine, but the oil
            stays cool and keeps the taste of the seed. This is how we make every bottle.
          </p>
        </Container>
      </section>
      <section className="bg-khaki-soft pb-14 md:pb-20">
        <Container>
          <ProcessSteps />
        </Container>
      </section>
      <Container className="max-w-3xl py-14 md:py-20">
        <Reveal className="prose-sm-custom">
          <h2>The ghani</h2>
          <p>TODO(client): describe the ghani itself: wood type, how many, who runs them, how long a batch takes.</p>
          <h2>Where the seeds come from</h2>
          <p>TODO(client): seed sourcing story (farms, regions, how seeds are chosen).</p>
          <h2>What we never do</h2>
          <ul>
            <li>No external heat during pressing</li>
            <li>No chemical solvents</li>
            <li>No bleaching, deodorising or refining</li>
            <li>No added colour, flavour or preservatives</li>
          </ul>
        </Reveal>
        <Reveal className="mt-12">
          <h2 className="mb-6 text-3xl">Kachi ghani vs refined</h2>
          <ComparisonTable />
        </Reveal>
        <div className="mt-10 flex flex-wrap gap-3">
          <LinkButton href="/collections/wood-pressed-oils" size="lg">
            Shop oils
          </LinkButton>
          <LinkButton href="/lab-reports" size="lg" variant="secondary">
            See lab reports
          </LinkButton>
        </div>
      </Container>
    </>
  );
}
