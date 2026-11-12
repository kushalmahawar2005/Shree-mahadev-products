import Link from "next/link";
import { ChevronRight, ExternalLink, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { CopyId } from "@/components/account/OrderDetailClient";
import { fullAddress, site, whatsappLink } from "@/data/site";
import { primaryBtn } from "@/lib/account/ui-classes";
import { cn } from "@/lib/utils/cn";
import { formatName, formatPhone } from "@/lib/utils/format";
import { supportStatus } from "./help-lib";

const card = "rounded-3xl border border-line bg-white p-5 shadow-co-card md:p-6";
const POLICIES = [
  { href: "/policies/shipping", label: "Shipping policy" },
  { href: "/policies/refund-return", label: "Refund & returns" },
  { href: "/policies/privacy", label: "Privacy policy" },
  { href: "/policies/terms", label: "Terms of service" },
];

/** Live status (IST hours from config) + one-tap contact rows. All values from the site config. */
export function ContactCard({ name, phone }: { name: string; phone: string }) {
  const status = supportStatus();
  const wa = whatsappLink(`Hi, I'm ${formatName(name)} (${formatPhone(phone)}). I need help with…`);
  const maps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${site.name}, ${fullAddress}`)}`;
  return (
    <section className={card} aria-labelledby="contact-h">
      <h2 id="contact-h" className="text-base font-bold text-ink">
        Contact us
      </h2>
      <p className="mt-1 flex items-center gap-2 text-sm text-ink-muted" aria-live="polite">
        <span className={cn("size-2 rounded-full", status.online ? "bg-co-success ring-4 ring-co-success/15" : "bg-co-border-strong")} />
        {status.text}
      </p>
      <a href={wa} target="_blank" rel="noopener noreferrer" className={cn(primaryBtn, "mt-4 whitespace-nowrap")}>
        <MessageCircle className="size-4" /> Chat on WhatsApp
      </a>
      <ul className="mt-4 divide-y divide-line text-sm">
        <li className="flex items-center gap-3 py-3">
          <Phone className="size-4 shrink-0 text-ink-muted" />
          <a href={site.phoneHref} className="min-w-0 flex-1 font-semibold text-ink hover:underline">
            {formatPhone(site.phone)}
          </a>
          <span className="text-xs whitespace-nowrap text-ink-muted">Call {site.supportHours}</span>
        </li>
        <li className="flex items-center gap-3 py-3">
          <Mail className="size-4 shrink-0 text-ink-muted" />
          <a href={`mailto:${site.email}`} className="min-w-0 flex-1 truncate font-semibold text-ink hover:underline">
            {site.email}
          </a>
          <CopyId value={site.email} label="email" />
        </li>
        <li className="flex items-start gap-3 pt-3">
          <MapPin className="mt-0.5 size-4 shrink-0 text-ink-muted" />
          <div className="min-w-0 flex-1 text-ink-muted">
            <p className="font-semibold text-ink">{site.name}</p>
            <p>{fullAddress}</p>
            <a href={maps} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex h-9 items-center gap-1 font-semibold text-forest hover:underline">
              Open in Maps <ExternalLink className="size-3.5" />
            </a>
          </div>
        </li>
      </ul>
    </section>
  );
}

export function PolicyLinks() {
  return (
    <nav className={cn(card, "py-2 md:py-3")} aria-label="Policies">
      <ul className="divide-y divide-line">
        {POLICIES.map((p) => (
          <li key={p.href}>
            <Link href={p.href} className="flex h-12 items-center justify-between text-sm font-semibold text-ink hover:text-forest">
              {p.label} <ChevronRight className="size-4 text-ink-muted" />
            </Link>
          </li>
        ))}
      </ul>
      <p className="pt-2 pb-1 text-xs text-ink-muted">FSSAI Lic. No. {site.fssai}</p>
    </nav>
  );
}
