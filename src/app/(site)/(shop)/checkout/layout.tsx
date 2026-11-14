import Image from "next/image";
import Link from "next/link";
import { Lock, WhatsApp } from "@/components/icons/duo";
import { PaymentLogos } from "@/components/layout/PaymentLogos";
import { checkoutConfig } from "@/config/checkout";
import { site, whatsappLink } from "@/data/site";

const LOGO = "https://res.cloudinary.com/bmqxsylj/image/upload/f_auto,q_auto:good,c_limit,w_160/v1793735979/swadeshi-mahadev/static/logo.png";

/** Distraction-free checkout chrome: no nav, mega menus, announcement bar or big footer. */
export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="co-theme flex min-h-dvh flex-col bg-page text-ink">
      <header className="sticky top-0 z-40 border-b border-line bg-white">
        <div className="mx-auto grid h-16 max-w-6xl grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 md:h-[72px] md:px-6">
          <Link href="/" aria-label={`${site.name} home`} className="justify-self-start">
            <Image src={LOGO} alt={site.name} width={52} height={52} className="size-11 md:size-[52px]" priority />
          </Link>
          <p className="flex items-center gap-2 text-sm font-bold text-forest md:text-base">
            <Lock className="size-4" />
            <span className="hidden sm:inline">Secure checkout</span>
            <span className="sm:hidden">Checkout</span>
          </p>
          <a
            href={whatsappLink("Hi, I need help with my order at checkout.")}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 justify-self-end rounded-full px-2 py-1.5 text-xs font-semibold text-co-success hover:bg-co-success-soft md:px-3 md:text-sm"
          >
            <WhatsApp className="size-5" />
            <span className="hidden md:inline">Need help?</span> WhatsApp
          </a>
        </div>
      </header>

      <div className="flex flex-1 flex-col [&>*]:flex-1">{children}</div>

      <footer className="border-t border-line bg-white pb-28 lg:pb-0">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 py-5 text-xs text-ink-muted md:flex-row md:justify-between md:px-6">
          <p>
            © {site.name} · FSSAI Lic. No. <span className="tabular-nums">{site.fssai}</span>
          </p>
          <PaymentLogos only={["UPI", "Visa", "Mastercard", "RuPay", "Google Pay", "PhonePe"]} size="sm" />
          <nav className="flex flex-wrap justify-center gap-x-4 gap-y-1" aria-label="Policies">
            {checkoutConfig.policyLinks.map((l) => (
              <Link key={l.href} href={l.href} className="hover:text-forest-text hover:underline">
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  );
}
