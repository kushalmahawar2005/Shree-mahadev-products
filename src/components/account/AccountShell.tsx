"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import NumberFlow from "@number-flow/react";
import {
  BadgeCheck,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  MapPin,
  Package,
  UserCog,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/shadcn/tooltip";
import { logoutCustomerAction } from "@/lib/customer-account-actions";
import { formatName, formatPhone, initials } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import type { AccountShellData } from "@/lib/server/account";
import { ConfirmDialog } from "./shared";
import { NamePrompt } from "./NamePrompt";
import { AddEmailPrompt } from "./AddEmailPrompt";

const NAV = [
  {
    href: "/account",
    label: "Overview",
    short: "Overview",
    icon: LayoutDashboard,
  },
  {
    href: "/account/orders",
    label: "My orders",
    short: "Orders",
    icon: Package,
  },
  {
    href: "/account/addresses",
    label: "Addresses",
    short: "Addresses",
    icon: MapPin,
  },
  {
    href: "/account/profile",
    label: "Profile & security",
    short: "Profile",
    icon: UserCog,
  },
  {
    href: "/account/help",
    label: "Help & support",
    short: "Help",
    icon: LifeBuoy,
  },
] as const;
const INR = {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
} as const;

const isActive = (path: string, href: string) =>
  href === "/account" ? path === href : path.startsWith(href);

/** Desktop: profile card + nav on the left (sticky), page on the right. Phones: compact header + tab bar. */
export function AccountShell({
  data,
  children,
}: {
  data: AccountShellData;
  children: React.ReactNode;
}) {
  return (
    <TooltipProvider delayDuration={300}>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-8">
        <aside className="hidden lg:col-span-4 lg:block">
          <div className="space-y-4 lg:sticky lg:top-[calc(var(--sticky-top,80px)+24px)]">
            <ProfileCard data={data} />
            <DesktopNav activeOrders={data.activeOrders} />
          </div>
        </aside>
        <div className="lg:hidden">
          <ProfileCard data={data} compact />
        </div>
        <MobileTabs activeOrders={data.activeOrders} />
        <main id="account-main" className="min-w-0 lg:col-span-8">
          {/* New accounts (email or WhatsApp sign-up) still named "Customer": ask once, here. */}
          {(!data.customer.name.trim() || /^customer$/i.test(data.customer.name.trim())) && <NamePrompt />}
          {/* No email yet (WhatsApp sign-up): add one here so email login opens this same account. */}
          {!data.customer.email.trim() && <AddEmailPrompt />}
          {children}
        </main>
      </div>
    </TooltipProvider>
  );
}

function ProfileCard({
  data,
  compact,
}: {
  data: AccountShellData;
  compact?: boolean;
}) {
  const c = data.customer;
  const name = formatName(c.name) || "Welcome";
  const stats = [
    { label: "Orders", value: data.stats.orders, money: false },
    { label: "Spent", value: data.stats.spent, money: true },
    { label: "Saved", value: data.stats.saved, money: true },
  ];
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-3xl bg-forest text-white shadow-co-card",
        compact ? "p-4" : "p-5",
      )}
    >
      <span
        aria-hidden
        className="absolute -top-16 -right-16 size-44 rounded-full bg-white/[0.05]"
      />
      <div className="relative flex items-center gap-3.5">
        <span
          className={cn(
            "grid shrink-0 place-items-center rounded-full bg-co-gold font-extrabold text-forest-deep ring-4 ring-white/10",
            compact ? "size-12 text-lg" : "size-14 text-xl",
          )}
        >
          {initials(c.name)}
        </span>
        <div className="min-w-0 flex-1">
          <p
            className="font-hindi text-sm leading-snug text-co-gold"
            lang="hi"
          >
            नमस्ते
          </p>
          <p
            className={cn(
              "truncate font-bold text-white",
              compact ? "text-lg" : "text-xl",
            )}
          >
            {name}
          </p>
          <p className="flex items-center gap-1.5 text-[13px] text-white/75">
            {formatPhone(c.phone)}
            <BadgeCheck
              className="size-4 text-co-gold"
              aria-label="Verified number"
            />
          </p>
        </div>
      </div>
      {c.email && !compact && (
        <Tooltip>
          <TooltipTrigger asChild>
            <p className="relative mt-3 truncate text-[13px] text-white/65">
              {c.email}
            </p>
          </TooltipTrigger>
          <TooltipContent>{c.email}</TooltipContent>
        </Tooltip>
      )}
      <dl
        className={cn(
          "relative grid grid-cols-3 divide-x divide-white/10 rounded-2xl bg-white/[0.08] text-center",
          compact ? "mt-3 py-2.5" : "mt-4 py-3",
        )}
        aria-live="polite"
      >
        {stats.map((s) => (
          <div key={s.label} className="flex min-w-0 flex-col-reverse px-1">
            <dt className="text-[11px] tracking-wide text-white/65 uppercase">
              {s.label}
            </dt>
            <dd
              className={cn(
                "truncate font-extrabold tabular-nums",
                compact ? "text-base" : "text-lg",
              )}
            >
              <NumberFlow
                value={s.value}
                format={s.money ? INR : undefined}
                locales="en-IN"
              />
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function DesktopNav({ activeOrders }: { activeOrders: number }) {
  const path = usePathname();
  const [confirm, setConfirm] = useState(false);
  return (
    <nav
      aria-label="Account"
      className="rounded-3xl border border-line bg-white p-2 shadow-co-card"
    >
      <ul className="space-y-0.5">
        {NAV.map(({ href, label, icon: Icon }) => {
          const on = isActive(path, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "relative flex h-11 items-center gap-3 rounded-xl px-3.5 text-sm font-semibold transition-colors",
                  on
                    ? "bg-co-accent-soft text-ink"
                    : "text-ink-muted hover:bg-page hover:text-ink",
                )}
              >
                {on && (
                  <motion.span
                    layoutId="acct-nav"
                    aria-hidden
                    className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-forest"
                  />
                )}
                <Icon
                  className={cn(
                    "size-[18px]",
                    on ? "text-forest" : "text-ink-muted",
                  )}
                />
                {label}
                {href === "/account/orders" && activeOrders > 0 && (
                  <span
                    className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-forest px-1.5 text-[11px] font-bold text-white"
                    aria-label={`${activeOrders} active`}
                  >
                    {activeOrders}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="my-1.5 border-t border-line" />
      <button
        type="button"
        onClick={() => setConfirm(true)}
        className="flex h-11 w-full items-center gap-3 rounded-xl px-3.5 text-sm font-semibold text-co-danger hover:bg-co-danger/5"
      >
        <LogOut className="size-[18px]" /> Log out
      </button>
      <LogoutConfirm open={confirm} onOpenChange={setConfirm} />
    </nav>
  );
}

function LogoutConfirm({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Log out?"
      description="You'll need an OTP on your mobile to sign in again. Your cart stays on this device."
      confirmLabel="Log out"
      danger
      onConfirm={() => logoutCustomerAction()}
    />
  );
}

/** Phones/tablets: sticky, scrollable tab bar under the site header; the active tab scrolls into view. */
function MobileTabs({ activeOrders }: { activeOrders: number }) {
  const path = usePathname();
  const ref = useRef<HTMLDivElement>(null);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    const scroller = ref.current;
    const active = scroller?.querySelector<HTMLElement>("[aria-current=page]");
    if (!scroller || !active) return;
    // Keep the horizontal tab reveal inside this rail; scrollIntoView can also
    // shift the document horizontally when the active tab sits near an edge.
    scroller.scrollTo({
      left: active.offsetLeft + active.offsetWidth / 2 - scroller.clientWidth / 2,
      behavior: "smooth",
    });
  }, [path]);
  return (
    <div className="sticky top-[var(--sticky-top,64px)] z-20 -mx-4 border-b border-line bg-page/95 backdrop-blur lg:hidden">
      <div
        ref={ref}
        className="flex snap-x gap-1 overflow-x-auto px-4 [scrollbar-width:none]"
        role="tablist"
        aria-label="Account sections"
      >
        {NAV.map(({ href, short }) => {
          const on = isActive(path, href);
          return (
            <Link
              key={href}
              href={href}
              role="tab"
              aria-selected={on}
              aria-current={on ? "page" : undefined}
              className={cn(
                "relative flex h-12 shrink-0 snap-start items-center gap-1.5 px-3 text-sm font-semibold",
                on ? "text-ink" : "text-ink-muted",
              )}
            >
              {short}
              {href === "/account/orders" && activeOrders > 0 && (
                <span className="grid h-5 min-w-5 place-items-center rounded-full bg-forest px-1 text-[11px] font-bold text-white">
                  {activeOrders}
                </span>
              )}
              {on && (
                <motion.span
                  layoutId="acct-tab"
                  aria-hidden
                  className="absolute inset-x-2 bottom-0 h-[3px] rounded-full bg-forest"
                />
              )}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setConfirm(true)}
          className="flex h-12 shrink-0 items-center px-3 text-sm font-semibold text-co-danger"
        >
          Log out
        </button>
      </div>
      <LogoutConfirm open={confirm} onOpenChange={setConfirm} />
    </div>
  );
}
