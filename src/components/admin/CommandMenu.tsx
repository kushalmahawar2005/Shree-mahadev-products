"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Package, Plus, Search, ShoppingBag, Users } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/shadcn/command";
import type { AdminNavItem } from "./AdminShell";

const OPEN_EVENT = "smp:open-command-menu";

/** Opens the ⌘K palette from anywhere (header button, mobile search icon). */
export function openCommandMenu() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

/** ⌘K / Ctrl+K palette: jump to any admin page, or search orders, products and customers. */
export function CommandMenu({ items }: { items: AdminNavItem[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_EVENT, onOpen);
    };
  }, []);

  const go = (href: string) => {
    setOpen(false);
    setQuery("");
    router.push(href);
  };

  const q = query.trim();
  const can = (href: string) => items.some((n) => n.href === href);

  return (
    <CommandDialog open={open} onOpenChange={setOpen} title="Search admin" description="Jump to a page or search orders, products and customers">
      <CommandInput placeholder="Type a page, order no., name or phone…" value={query} onValueChange={setQuery} />
      <CommandList>
        <CommandEmpty>No matching page.</CommandEmpty>
        {q && (
          <CommandGroup heading="Search">
            {can("/admin/orders") && (
              <CommandItem value={`search orders ${q}`} onSelect={() => go(`/admin/orders?f=all&q=${encodeURIComponent(q)}`)}>
                <ShoppingBag /> Orders matching “{q}”
              </CommandItem>
            )}
            {can("/admin/products") && (
              <CommandItem value={`search products ${q}`} onSelect={() => go(`/admin/products?q=${encodeURIComponent(q)}`)}>
                <Package /> Products matching “{q}”
              </CommandItem>
            )}
            {can("/admin/customers") && (
              <CommandItem value={`search customers ${q}`} onSelect={() => go(`/admin/customers?q=${encodeURIComponent(q)}`)}>
                <Users /> Customers matching “{q}”
              </CommandItem>
            )}
          </CommandGroup>
        )}
        {can("/admin/products") && (
          <CommandGroup heading="Quick actions">
            <CommandItem onSelect={() => go("/admin/products/edit")}>
              <Plus /> Add a product
            </CommandItem>
            <CommandItem onSelect={() => go("/admin/orders?f=to_ship")}>
              <Search /> Orders to ship
            </CommandItem>
          </CommandGroup>
        )}
        <CommandSeparator />
        <CommandGroup heading="Go to">
          {items.map((n) => (
            <CommandItem key={n.href} value={`${n.label} ${n.section}`} onSelect={() => go(n.href)}>
              <n.icon /> {n.label}
              <CommandShortcut>{n.section}</CommandShortcut>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
