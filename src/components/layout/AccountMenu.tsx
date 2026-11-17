"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "motion/react";
import { LifeBuoy, LogOut, MapPin, Package, UserCog } from "lucide-react";
import { AccountMenuLogin, LOGIN_INITIAL, type LoginState } from "./AccountMenuLogin";
import { useSignedIn } from "@/hooks/use-signed-in";
import { getAccountMenuAction, logoutCustomerAction } from "@/lib/customer-account-actions";
import { formatName, initials } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { UserIcon } from "./icons";

/** Motion tokens for this menu (easeOutExpo / easeOutQuart). */
const EXPO = [0.16, 1, 0.3, 1] as const;
const QUART = [0.25, 1, 0.5, 1] as const;
const OPEN_DELAY = 120;
const CLOSE_DELAY = 200;

type Summary = { name: string; phone: string; activeOrders: number };

const LINKS = [
  { href: "/account/orders", label: "My orders", icon: Package, badge: true },
  { href: "/account/addresses", label: "Addresses", icon: MapPin },
  { href: "/account/profile", label: "Profile & security", icon: UserCog },
  { href: "/account/help", label: "Help & support", icon: LifeBuoy },
] as const;


/**
 * Header account button + dropdown (desktop header, full and compact).
 * Hover opens after 120ms, leaving trigger + panel closes after 200ms (the panel's top padding is the
 * hover bridge). Click / Enter / Space toggle, Esc closes and returns focus, arrow keys move between items.
 */
export function AccountMenu({ compact = false, tabIndex }: { compact?: boolean; tabIndex?: number }) {
  const signedIn = useSignedIn();
  const guest = signedIn === false;
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [login, setLogin] = useState<LoginState>(LOGIN_INITIAL);
  // Once the guest starts typing, hover-out no longer closes the panel (outside click / Esc still do).
  const [pinned, setPinned] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const schedule = (next: boolean, ms: number) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(next), ms);
  };
  const close = useCallback((refocus = false) => {
    clearTimeout(timer.current);
    setOpen(false);
    setPinned(false);
    if (refocus) trigger.current?.focus();
  }, []);

  // Fetch name / phone / active orders each time the menu opens (cheap; picks up a just-saved name).
  useEffect(() => {
    if (!open || signedIn !== true) return;
    let alive = true;
    getAccountMenuAction().then((s) => alive && s && setSummary(s)).catch(() => {});
    return () => {
      alive = false;
    };
  }, [open, signedIn]);

  // Outside tap / click closes (touch has no mouseleave).
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !root.current?.contains(e.target as Node) && close();
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open, close]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const items = () => Array.from(panel.current?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? []);
  const focusItem = (dir: 1 | -1 | "first" | "last") => {
    const list = items();
    if (!list.length) return;
    const i = list.indexOf(document.activeElement as HTMLElement);
    const next = dir === "first" ? 0 : dir === "last" ? list.length - 1 : (i + dir + list.length) % list.length;
    list[next]?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const typing = (e.target as HTMLElement).tagName === "INPUT";
    if (e.key === "Escape" && open) {
      e.preventDefault();
      close(true);
    } else if (!typing && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        requestAnimationFrame(() => focusItem(e.key === "ArrowDown" ? "first" : "last"));
      } else focusItem(e.key === "ArrowDown" ? 1 : -1);
    } else if (!typing && open && (e.key === "Home" || e.key === "End")) {
      e.preventDefault();
      focusItem(e.key === "Home" ? "first" : "last");
    } else if (e.key === "Tab" && open) {
      // Close only when focus actually leaves the menu (the login form has several fields).
      requestAnimationFrame(() => !root.current?.contains(document.activeElement) && close());
    }
  };

  const label = guest ? "Login" : "Account";

  return (
    <div
      ref={root}
      className="relative"
      onPointerEnter={(e) => e.pointerType === "mouse" && schedule(true, OPEN_DELAY)}
      onPointerLeave={(e) => e.pointerType === "mouse" && !pinned && schedule(false, CLOSE_DELAY)}
      onKeyDown={onKeyDown}
    >
      <button
        ref={trigger}
        type="button"
        tabIndex={tabIndex}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={label}
        onClick={() => {
          clearTimeout(timer.current);
          setOpen((o) => !o);
        }}
        className={cn(
          "group/act flex items-center justify-center rounded-xl text-forest transition-colors duration-200",
          compact ? "size-10" : "min-w-14 flex-col gap-0.5 px-2 py-1.5",
          open ? "bg-ivory" : "hover:bg-forest/5",
        )}
      >
        <span className={cn("relative grid size-7 place-items-center transition-transform duration-200 [transition-timing-function:cubic-bezier(0.25,1,0.5,1)]", open ? "-translate-y-px" : "group-hover/act:-translate-y-px")}>
          <UserIcon className="size-[22px]" />
          {guest && <span aria-hidden className="absolute -top-0.5 -right-1 size-2.5 rounded-full bg-co-accent ring-2 ring-white" />}
        </span>
        {!compact && <span className="text-[11px] leading-none font-bold text-forest-text">{label}</span>}
      </button>

      <AnimatePresence>
        {open && signedIn !== null && (
          <motion.div
            ref={panel}
            id={menuId}
            role="menu"
            aria-label={guest ? "Login" : "Account menu"}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.97 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1, transition: { duration: 0.22, ease: EXPO } }}
            exit={reduce ? { opacity: 0, transition: { duration: 0.14 } } : { opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.14, ease: QUART } }}
            style={{ transformOrigin: compact ? "calc(100% - 20px) 0" : "calc(100% - 36px) 0" }}
            // pt-2 = 8px gap that doubles as the hover bridge between the icon and the panel.
            className="absolute top-full right-0 z-50 pt-2"
          >
            <span
              aria-hidden
              className={cn("absolute top-[3px] size-2.5 rotate-45 rounded-[2px] border-t border-l border-line", guest ? "bg-white" : "bg-ivory", compact ? "right-[15px]" : "right-[31px]")}
            />
            <div
              className={cn(
                "overflow-hidden rounded-2xl border border-line bg-white text-left shadow-[0_1px_2px_rgba(7,47,27,0.06),0_8px_16px_-6px_rgba(7,47,27,0.12),0_24px_48px_-20px_rgba(7,47,27,0.22)]",
                guest ? "w-[300px]" : "w-[280px]",
              )}
            >
              {guest ? <AccountMenuLogin state={login} setState={setLogin} onEngage={() => setPinned(true)} reduce={!!reduce} /> : <SignedInPanel summary={summary} reduce={!!reduce} onNavigate={() => close()} />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const stagger = (step: number): Variants => ({ show: { transition: { staggerChildren: step, delayChildren: 0.06 } } });
const rise = (reduce: boolean): Variants => ({
  hidden: reduce ? { opacity: 0 } : { opacity: 0, y: 4 },
  show: { opacity: 1, y: 0, transition: { duration: 0.24, ease: QUART } },
});

function SignedInPanel({ summary, reduce, onNavigate }: { summary: Summary | null; reduce: boolean; onNavigate: () => void }) {
  const [active, setActive] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const pillId = useId();
  const first = summary?.name ? formatName(summary.name).split(" ")[0] : "";
  const row = "relative flex h-11 w-full items-center gap-3 px-4 text-[14.5px] font-medium outline-none";

  const pill = (id: string) =>
    active === id ? (
      <motion.span
        layoutId={pillId}
        aria-hidden
        className="absolute inset-x-1.5 inset-y-0.5 -z-0 rounded-xl bg-ivory"
        transition={reduce ? { duration: 0 } : { duration: 0.18, ease: QUART }}
      />
    ) : null;

  const track = (id: string) => ({
    onPointerEnter: () => setActive(id),
    onFocus: () => setActive(id),
  });

  return (
    <div onPointerLeave={() => setActive(null)}>
      <div className="flex items-center gap-3 bg-ivory p-4">
        <motion.span
          initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
          animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1 }}
          transition={{ duration: 0.22, ease: EXPO }}
          aria-hidden
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-full",
            first ? "bg-forest text-[15px] font-semibold text-white shadow-[inset_0_0_0_1.5px_rgba(232,200,121,0.4)]" : "bg-forest/10 text-lg",
          )}
        >
          {first ? initials(summary!.name) : "🙏"}
        </motion.span>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.22, ease: EXPO, delay: reduce ? 0 : 0.04 }}
          className="min-w-0 flex-1"
        >
          {first ? (
            <Link href="/account" prefetch={false} role="menuitem" onClick={onNavigate} className="block truncate rounded text-[16px] leading-tight font-semibold text-ink hover:text-forest-text focus-visible:text-forest-text focus-visible:outline-none">
              {first}
            </Link>
          ) : (
            <p className="flex items-baseline gap-2 text-[16px] leading-tight font-semibold text-ink">
              Namaste!
              <Link href="/account/profile?edit=name" prefetch={false} role="menuitem" onClick={onNavigate} className="rounded text-[13px] font-semibold text-forest-text underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none">
                Naam jodein ›
              </Link>
            </p>
          )}
          <p className="mt-0.5 h-[18px] truncate text-[13px] text-ink-muted tabular-nums">{summary?.phone ?? ""}</p>
        </motion.div>
      </div>

      <motion.ul variants={stagger(0.03)} initial="hidden" animate="show" className="py-1.5">
        {LINKS.map(({ href, label, icon: Icon, ...rest }) => {
          const count = "badge" in rest && summary ? summary.activeOrders : 0;
          return (
            <motion.li key={href} variants={rise(reduce)}>
              <Link href={href} prefetch={false} role="menuitem" onClick={onNavigate} className={cn(row, "group/row text-ink")} {...track(href)}>
                {pill(href)}
                <Icon
                  className={cn("relative size-[18px] shrink-0 text-forest transition-transform duration-200 [transition-timing-function:cubic-bezier(0.25,1,0.5,1)]", active === href && !reduce && "translate-x-0.5")}
                  strokeWidth={1.8}
                  aria-hidden
                />
                <span className="relative flex-1">{label}</span>
                {count > 0 && (
                  <span className="relative grid h-5 min-w-5 place-items-center rounded-full bg-forest px-1.5 text-[11px] font-bold text-white tabular-nums" aria-label={`${count} active`}>
                    {count}
                  </span>
                )}
              </Link>
            </motion.li>
          );
        })}
      </motion.ul>

      <div className="border-t border-line py-1.5">
        <AnimatePresence mode="wait" initial={false}>
          {confirm ? (
            <motion.div
              key="confirm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { duration: 0.16, ease: QUART } }}
              exit={{ opacity: 0, transition: { duration: 0.1 } }}
              className="flex h-11 items-center gap-2 px-4"
            >
              <span className="flex-1 text-[14px] font-medium text-ink">Log out karein?</span>
              <form action={logoutCustomerAction}>
                <button type="submit" role="menuitem" autoFocus className="h-8 rounded-full bg-red-600 px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-red-700 focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:outline-none">
                  Haan
                </button>
              </form>
              <button type="button" role="menuitem" onClick={() => setConfirm(false)} className="h-8 rounded-full border border-line px-3.5 text-[13px] font-semibold text-ink transition-colors hover:bg-ivory focus-visible:ring-2 focus-visible:ring-forest/30 focus-visible:outline-none">
                Nahi
              </button>
            </motion.div>
          ) : (
            <motion.button
              key="logout"
              type="button"
              role="menuitem"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { duration: 0.16, ease: QUART } }}
              exit={{ opacity: 0, transition: { duration: 0.1 } }}
              onClick={() => setConfirm(true)}
              className={cn(row, "group/out text-ink-muted transition-colors hover:text-red-700 focus-visible:text-red-700")}
              {...track("logout")}
            >
              {pill("logout")}
              <LogOut className="relative size-[18px] shrink-0" strokeWidth={1.8} aria-hidden />
              <span className="relative">Log out</span>
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
