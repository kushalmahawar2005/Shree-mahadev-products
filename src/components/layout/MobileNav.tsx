"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ChevronRight, Flame } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/shadcn/sheet";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/shadcn/accordion";
import { thumbUrl } from "@/lib/image-loader";
import { formatMoney } from "@/lib/utils/money";
import { site, shopByUse, whatsappLink, type NavItem } from "@/data/site";
import { UserIcon, WhatsAppIcon } from "./icons";
import type { MenuData } from "./MegaMenu";

const LOGO = "https://res.cloudinary.com/bmqxsylj/image/upload/v1793735979/swadeshi-mahadev/static/logo.png";
const shortName = (t: string) => t.replace(/^(Wood|Cold)-Pressed\s+/, "");

const MORE = [
  { label: "Our Ghani", href: "/our-ghani" },
  { label: "Lab Reports", href: "/lab-reports" },
  { label: "Bulk orders", href: "/bulk-orders" },
  { label: "Contact", href: "/contact" },
];

/**
 * Phone menu: a full-height left sheet (shadcn Sheet) with accordion categories (product thumbnails
 * + price), Shop by use, the brand pages, WhatsApp help and the account link at the bottom.
 */
export function MobileNav({ open, onClose, menus, nav }: { open: boolean; onClose: () => void; menus: MenuData; nav: NavItem[] }) {
  const categories = nav.filter((n) => n.menu);
  const plain = nav.filter((n) => !n.menu && n.href !== "/" && !MORE.some((m) => m.href === n.href) && !/contact/i.test(n.href));

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="left" className="flex w-[88vw] max-w-sm flex-col gap-0 border-line bg-page p-0" data-lenis-prevent="">
        <div className="flex items-center gap-3 border-b border-line bg-white px-5 py-3">
          <Image src={LOGO} alt="" width={40} height={40} unoptimized className="size-10" />
          <div>
            <SheetTitle className="text-base text-forest-text">Swadeshi Mahadev</SheetTitle>
            <SheetDescription className="text-xs text-ink-muted">Kachi ghani oils, honey & sweeteners</SheetDescription>
          </div>
        </div>

        <nav aria-label="Mobile" className="flex-1 overflow-y-auto px-4 py-3">
          {/* Categories with thumbnails */}
          <Accordion type="single" collapsible defaultValue={categories[0]?.menu}>
            {categories.map((c) => (
              <AccordionItem key={c.href} value={c.menu!} className="border-line">
                <AccordionTrigger className="py-3.5 text-base font-semibold text-forest-text hover:no-underline">{c.label}</AccordionTrigger>
                <AccordionContent>
                  <ul className="grid gap-1">
                    {menus[c.menu!].map((p) => (
                      <li key={p.handle}>
                        <Link href={`/products/${p.handle}`} onClick={onClose} className="flex min-h-12 items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-white">
                          <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-lg bg-khaki-soft">
                            <Image src={p.image ? thumbUrl(p.image, 44) : "/logo.svg"} alt="" width={44} height={44} unoptimized className="size-10 object-contain" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-forest-text">{shortName(p.title)}</span>
                            <span className="font-hindi block text-xs text-sale" lang="hi">
                              {p.titleHi}
                            </span>
                          </span>
                          <span className="text-xs font-semibold text-ink-muted tabular-nums">{p.from ? `from ${formatMoney(p.from)}` : "Soon"}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <Link href={c.href} onClick={onClose} className="mt-2 inline-flex items-center gap-1 px-2 text-sm font-semibold text-forest">
                    All {c.label.toLowerCase()} <ArrowRight className="size-4" />
                  </Link>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          {plain.length > 0 && (
            <ul className="border-b border-line py-2">
              {plain.map((n) => (
                <li key={n.href}>
                  <Link href={n.href} onClick={onClose} className="flex min-h-12 items-center gap-2 text-base font-semibold text-forest-text">
                    {n.icon === "bestseller" && <Flame className="size-4 text-mustard" aria-hidden />}
                    {n.label}
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {/* Shop by use */}
          <p className="mt-5 mb-2 px-1 text-[11px] font-semibold tracking-[0.16em] text-ink-muted uppercase">Shop by use</p>
          <ul className="flex flex-wrap gap-2">
            {shopByUse.map((u) => (
              <li key={u.tag}>
                <Link href={`/shop?use=${u.tag}`} onClick={onClose} className="inline-flex h-9 items-center rounded-full border border-line bg-white px-3.5 text-sm font-medium text-forest-text">
                  {u.label}
                </Link>
              </li>
            ))}
          </ul>

          {/* Brand pages */}
          <ul className="mt-5 divide-y divide-line rounded-2xl border border-line bg-white">
            {MORE.map((m) => (
              <li key={m.href}>
                <Link href={m.href} onClick={onClose} className="flex min-h-12 items-center justify-between px-4 text-[15px] font-medium text-forest-text">
                  {m.label} <ChevronRight className="size-4 text-ink-muted" />
                </Link>
              </li>
            ))}
          </ul>

          <a
            href={whatsappLink("Hi, I have a question about your products.")}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 flex min-h-12 items-center justify-center gap-2 rounded-full bg-forest font-semibold text-white"
          >
            <WhatsAppIcon className="size-5" /> Chat on WhatsApp
          </a>
          <p className="mt-2 text-center text-xs text-ink-muted">
            {site.phone} · {site.supportHours}
          </p>
        </nav>

        {/* Account at the bottom */}
        <Link href="/account" onClick={onClose} className="flex min-h-14 items-center gap-3 border-t border-line bg-white px-5 font-semibold text-forest-text">
          <UserIcon className="size-5" /> My account
          <ChevronRight className="ml-auto size-4 text-ink-muted" />
        </Link>
      </SheetContent>
    </Sheet>
  );
}
