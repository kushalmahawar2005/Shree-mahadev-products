"use client";

import Link from "next/link";
import { useState } from "react";
import { Drawer } from "@/components/ui/Drawer";
import { SwatchDot } from "@/components/ui/primitives";
import { site, utilityNav, whatsappLink, type MenuGroup, type NavItem } from "@/data/site";
import { cn } from "@/lib/utils/cn";
import { ChevronDown, CloseIcon, WhatsAppIcon } from "./icons";
import type { MenuData } from "./MegaMenu";

const shortName = (t: string) => t.replace(/^(Wood|Cold)-Pressed\s+/, "").replace(/ Oil$/, "");

export function MobileNav({
  open,
  onClose,
  menus,
  nav,
}: {
  open: boolean;
  onClose: () => void;
  menus: MenuData;
  nav: NavItem[];
}) {
  const [expanded, setExpanded] = useState<MenuGroup | null>("oils");

  return (
    <Drawer open={open} onClose={onClose} side="left" label="Menu" className="max-w-sm">
      <div className="flex items-center justify-between bg-khaki px-5 py-3">
        <span className="font-display text-xl text-forest-text">Menu</span>
        <button
          type="button"
          onClick={onClose}
          className="grid size-11 place-items-center rounded-full text-forest-text hover:bg-white/30"
          aria-label="Close menu"
        >
          <CloseIcon />
        </button>
      </div>

      <nav aria-label="Mobile" className="flex-1 overflow-y-auto px-5 py-2">
        <form action="/search" role="search" className="my-3" onSubmit={onClose}>
          <label htmlFor="mobile-search" className="sr-only">
            Search products
          </label>
          <input
            id="mobile-search"
            name="q"
            type="search"
            placeholder="Search popular products..."
            className="min-h-12 w-full rounded-full border border-line bg-khaki-soft px-5 focus:border-forest focus:outline-none"
          />
        </form>

        <ul className="divide-y divide-line">
          {nav.map((item) => (
            <li key={item.href}>
              {item.menu ? (
                <>
                  <div className="flex items-center">
                    <Link
                      href={item.href}
                      onClick={onClose}
                      className="flex min-h-13 flex-1 items-center text-lg font-semibold text-forest-text"
                    >
                      {item.label}
                    </Link>
                    <button
                      type="button"
                      aria-label={`Show ${item.label}`}
                      aria-expanded={expanded === item.menu}
                      onClick={() => setExpanded(expanded === item.menu ? null : item.menu!)}
                      className="grid size-11 place-items-center rounded-full text-forest-text hover:bg-khaki-soft"
                    >
                      <ChevronDown
                        className={cn("size-5 transition-transform duration-200", expanded === item.menu && "rotate-180")}
                      />
                    </button>
                  </div>
                  {expanded === item.menu && (
                    <ul className="grid grid-cols-2 gap-1 pb-3">
                      {menus[item.menu].map((p) => (
                        <li key={p.handle}>
                          <Link
                            href={`/products/${p.handle}`}
                            onClick={onClose}
                            className="flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm hover:bg-khaki-soft"
                          >
                            <SwatchDot color={p.swatch} />
                            <span>{shortName(p.title)}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              ) : (
                <Link
                  href={item.href}
                  onClick={onClose}
                  className="flex min-h-13 items-center text-lg font-semibold text-forest-text"
                >
                  {item.label}
                </Link>
              )}
            </li>
          ))}
        </ul>

        <ul className="mt-4 grid grid-cols-2 gap-x-4 border-t border-line pt-4">
          {utilityNav.map((l) => (
            <li key={l.label}>
              <Link href={l.href} onClick={onClose} className="flex min-h-11 items-center text-forest-text">
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="border-t border-line p-5">
        <a
          href={whatsappLink("Hi, I have a question about your products.")}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-forest font-semibold text-white"
        >
          <WhatsAppIcon className="size-5" /> Chat on WhatsApp
        </a>
        <p className="mt-3 text-center text-sm text-ink-muted">
          {site.phone} · {site.supportHours}
        </p>
      </div>
    </Drawer>
  );
}
