import type { Metadata } from "next";
import { FounderNote } from "@/components/home/Sections";
import { Container } from "@/components/ui/primitives";
import { fullAddress } from "@/data/site";
import { pageMetadata } from "@/lib/utils/seo";

export const metadata: Metadata = pageMetadata({
  title: "About us",
  description: "The family behind Swadeshi Mahadev Products and our kachi ghani in Bijainagar, Rajasthan.",
  path: "/about",
});

export default function AboutPage() {
  return (
    <>
      <Container className="max-w-3xl py-14 md:py-20">
        <h1 className="text-4xl md:text-5xl">From Bijainagar, with patience</h1>
        <div className="prose-sm-custom mt-6 text-lg">
          <p>
            Swadeshi Mahadev Products is a small kachi ghani unit in Bijainagar, in the Beawar district of
            Rajasthan. We press oil in a wooden ghani, the way it was done before refineries.
          </p>
          <p>TODO(client): founder story. When it started, why, and who is behind it.</p>
          <h2>Our mission</h2>
          <p>TODO(client): mission in the founder&apos;s words.</p>
          <h2>Visit us</h2>
          <p>{fullAddress}</p>
        </div>
      </Container>
      <FounderNote />
    </>
  );
}
