"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/lib/admin-login-actions";
import { useState } from "react";
import { cn } from "@/lib/utils/cn";
import { CloseIcon, MenuIcon } from "@/components/layout/icons";

const nav = [
  { label: "Dashboard", href: "/admin" },
  { label: "Orders", href: "/admin/orders" },
  { label: "Products", href: "/admin/products" },
  { label: "Inventory", href: "/admin/inventory" },
  { label: "Categories", href: "/admin/categories" },
  { label: "Abandoned carts", href: "/admin/abandoned-carts" },
  { label: "Customers", href: "/admin/customers" },
  { label: "Coupons", href: "/admin/discounts" },
  { label: "Reviews", href: "/admin/reviews" },
  { label: "Bulk inquiries", href: "/admin/inquiries" },
  { label: "Hero banners", href: "/admin/banners" },
  { label: "Videos", href: "/admin/videos" },
  { label: "Settings", href: "/admin/settings" },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }
  // The login page has no admin chrome.
  if (pathname === "/admin/login") return <>{children}</>;
  const active = (href: string) => (href === "/admin" ? pathname === href : pathname.startsWith(href));

  const sidebar = (
    <nav aria-label="Admin" className="flex h-full flex-col gap-1 p-4">
      <Link href="/admin" className="mb-4 flex items-center gap-3 px-2">
        <Image src="https://res.cloudinary.com/bmqxsylj/image/upload/v1793735979/swadeshi-mahadev/static/logo.png" alt="" width={44} height={44} unoptimized className="size-11" />
        <span className="leading-tight font-semibold text-white">
          Mahadev
          <span className="block text-sm font-normal text-white/60">Admin panel</span>
        </span>
      </Link>
      {nav.map((n) => (
        <Link
          key={n.href}
          href={n.href}
          className={cn(
            "flex min-h-11 items-center rounded-xl px-4 font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white",
            active(n.href) && "bg-white/15 text-white",
          )}
        >
          {n.label}
        </Link>
      ))}
      <Link href="/" target="_blank" className="mt-auto min-h-11 rounded-xl px-4 py-3 text-sm text-white/60 hover:text-white">
        View storefront ↗
      </Link>
    </nav>
  );

  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 bg-forest-deep lg:block">{sidebar}</aside>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-forest-deep">{sidebar}</aside>
        </div>
      )}

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-white px-4 sm:px-6">
          <button
            type="button"
            aria-label="Open menu"
            className="-ml-2 grid size-11 place-items-center rounded-full hover:bg-khaki-soft lg:hidden"
            onClick={() => setOpen(true)}
          >
            {open ? <CloseIcon /> : <MenuIcon />}
          </button>
          <p className="font-semibold text-forest-text">Swadeshi Mahadev Products</p>
          <form action={logoutAction} className="ml-auto">
            <button type="submit" className="min-h-10 rounded-full border border-line px-4 text-sm font-semibold text-forest-text hover:border-forest">
              Log out
            </button>
          </form>
        </header>
        <main className="p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

