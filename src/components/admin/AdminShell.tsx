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
  { label: "Collections", href: "/admin/categories" },
  { label: "Abandoned carts", href: "/admin/abandoned-carts" },
  { label: "Customers", href: "/admin/customers" },
  { label: "Coupons", href: "/admin/discounts" },
  { label: "Reviews", href: "/admin/reviews" },
  { label: "Bulk inquiries", href: "/admin/inquiries" },
  { label: "Marketing", href: "/admin/marketing" },
  { label: "Messages", href: "/admin/messages" },
  { label: "Shipping ops", href: "/admin/shipping" },
  { label: "Reports", href: "/admin/reports" },
  { label: "Hero banners", href: "/admin/banners" },
  { label: "Videos", href: "/admin/videos" },
  { label: "Settings", href: "/admin/settings" },
  { label: "Admin users", href: "/admin/settings/users" },
  { label: "Activity log", href: "/admin/activity" },
];

const sectionNames: Record<string, string> = {
  "/admin": "Overview",
  "/admin/orders": "Sales",
  "/admin/products": "Catalog",
  "/admin/inventory": "Catalog",
  "/admin/categories": "Catalog",
  "/admin/abandoned-carts": "Customers",
  "/admin/customers": "Customers",
  "/admin/discounts": "Growth",
  "/admin/reviews": "Growth",
  "/admin/inquiries": "Growth",
  "/admin/marketing": "Growth",
  "/admin/messages": "Operations",
  "/admin/shipping": "Operations",
  "/admin/reports": "Operations",
  "/admin/banners": "Storefront",
  "/admin/videos": "Storefront",
  "/admin/settings": "Settings",
  "/admin/settings/users": "Settings",
  "/admin/activity": "Settings",
};

export function AdminShell({ children, role }: { children: React.ReactNode; role: "owner" | "manager" | "staff" }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }
  // The login page has no admin chrome.
  if (pathname === "/admin/login") return <>{children}</>;
  const active = (href: string) =>
    href === "/admin" || href === "/admin/settings"
      ? pathname === href
      : pathname.startsWith(href);

  const allowedNav = nav.filter((n) =>
    role === "owner"
      ? true
      : role === "manager"
        ? !["/admin/settings", "/admin/settings/users", "/admin/activity"].includes(n.href)
        : ["/admin", "/admin/orders", "/admin/inquiries", "/admin/reviews"].includes(n.href),
  );
  const sidebar = (
    <nav aria-label="Admin" className="flex h-full min-h-0 flex-col px-3 pb-4 pt-5">
      <Link href="/admin" className="mb-7 flex items-center gap-3 px-2">
        <Image src="https://res.cloudinary.com/bmqxsylj/image/upload/v1793735979/swadeshi-mahadev/static/logo.png" alt="" width={46} height={46} unoptimized className="size-11 rounded-full bg-white/10 object-contain ring-1 ring-white/10" />
        <span className="leading-tight font-semibold tracking-wide text-white">
          Mahadev
          <span className="mt-1 block text-xs font-medium uppercase tracking-[0.16em] text-white/50">Admin workspace</span>
        </span>
      </Link>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
        {[...new Set(allowedNav.map((n) => sectionNames[n.href] ?? "More"))].map((section) => (
          <div key={section}>
            <p className="mb-1.5 px-4 text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">{section}</p>
            <div className="space-y-1">
              {allowedNav.filter((n) => (sectionNames[n.href] ?? "More") === section).map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={active(n.href) ? "page" : undefined}
                  className={cn(
                    "flex min-h-10 items-center rounded-xl border border-transparent px-4 text-[14px] font-medium text-white/70 transition-colors hover:bg-white/[0.08] hover:text-white",
                    active(n.href) && "border-white/10 bg-white/[0.13] font-semibold text-white shadow-sm",
                  )}
                >
                  {n.label}
                  {active(n.href) && <span aria-hidden className="ml-auto size-1.5 rounded-full bg-mustard" />}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
      <Link href="/" target="_blank" className="mt-4 flex min-h-11 shrink-0 items-center rounded-xl border border-white/10 px-4 text-sm font-medium text-white/65 transition-colors hover:border-white/20 hover:bg-white/[0.06] hover:text-white">
        View storefront <span className="ml-auto">↗</span>
      </Link>
    </nav>
  );

  return (
    <div className="flex min-h-dvh bg-[#f7f6f1] text-ink">
      <aside className="sticky top-0 hidden h-dvh w-[250px] shrink-0 bg-[#082f20] lg:block">{sidebar}</aside>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-[#082f20] shadow-2xl">{sidebar}</aside>
        </div>
      )}

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex h-[68px] items-center gap-3 border-b border-line/80 bg-white/95 px-4 shadow-[0_3px_14px_-12px_rgba(0,0,0,.3)] backdrop-blur sm:px-7">
          <button
            type="button"
            aria-label="Open menu"
            className="-ml-2 grid size-11 place-items-center rounded-full hover:bg-khaki-soft lg:hidden"
            onClick={() => setOpen(true)}
          >
            {open ? <CloseIcon /> : <MenuIcon />}
          </button>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-forest-text sm:text-base">Swadeshi Mahadev Products</p>
            <p className="hidden text-[11px] font-medium uppercase tracking-[0.15em] text-ink-muted sm:block">{sectionNames[pathname] ?? "Admin"} · Workspace</p>
          </div>
          <form action={logoutAction} className="ml-auto">
            <button type="submit" className="min-h-10 rounded-full border border-line px-4 text-sm font-semibold text-forest-text transition-colors hover:border-forest hover:bg-khaki-soft">
              Log out
            </button>
          </form>
        </header>
        <main id="main" className="mx-auto w-full max-w-[1680px] p-4 sm:p-6 xl:p-8">{children}</main>
      </div>
    </div>
  );
}
