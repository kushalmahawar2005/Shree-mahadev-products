import type { Metadata } from "next";
import { WhatsAppIcon } from "@/components/layout/icons";
import { buttonClass } from "@/components/ui/Button";
import { Container } from "@/components/ui/primitives";
import { fullAddress, site, whatsappLink } from "@/data/site";
import { pageMetadata } from "@/lib/utils/seo";

export const metadata: Metadata = pageMetadata({
  title: "Contact us",
  description: `Call or WhatsApp ${site.phone} (${site.supportHours}). ${fullAddress}.`,
  path: "/contact",
});

export default function ContactPage() {
  return (
    <Container className="max-w-3xl py-14 md:py-20">
      <h1 className="text-4xl md:text-5xl">Contact us</h1>
      <p className="mt-4 text-lg text-ink-muted">
        We are a small team. We reply between {site.supportHours}, Monday to Saturday. TODO(client): confirm days.
      </p>
      <dl className="mt-10 grid gap-6 sm:grid-cols-2">
        <div className="rounded-[var(--radius-card)] bg-khaki-soft p-6">
          <dt className="font-semibold text-forest-text">Phone / WhatsApp</dt>
          <dd className="mt-1">
            <a href={site.phoneHref} className="text-lg underline underline-offset-2">
              {site.phone}
            </a>
          </dd>
        </div>
        <div className="rounded-[var(--radius-card)] bg-khaki-soft p-6">
          <dt className="font-semibold text-forest-text">Email</dt>
          <dd className="mt-1 break-all">
            <a href={`mailto:${site.email}`} className="text-lg underline underline-offset-2">
              {site.email}
            </a>
          </dd>
        </div>
        <div className="rounded-[var(--radius-card)] bg-khaki-soft p-6 sm:col-span-2">
          <dt className="font-semibold text-forest-text">Address</dt>
          <dd className="mt-1">
            <address className="not-italic">{fullAddress}</address>
          </dd>
        </div>
      </dl>
      <a
        href={whatsappLink("Hi, I have a question.")}
        target="_blank"
        rel="noopener noreferrer"
        className={buttonClass("primary", "lg", "mt-8")}
      >
        <WhatsAppIcon className="size-5" /> Chat on WhatsApp
      </a>
    </Container>
  );
}
