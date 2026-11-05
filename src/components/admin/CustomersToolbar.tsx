"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Download, Loader2, Search, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/** Search-as-you-type + segment pills for /admin/customers. State lives in the URL. */
export function CustomersToolbar({
  q,
  filter,
  filters,
  exportHref,
}: {
  q: string;
  filter: string;
  filters: { id: string; label: string }[];
  exportHref: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [value, setValue] = useState(q);
  const [pending, start] = useTransition();
  const first = useRef(true);

  const go = (nextQ: string, nextF: string) => {
    const p = new URLSearchParams();
    if (nextQ.trim()) p.set("q", nextQ.trim());
    if (nextF !== "all") p.set("f", nextF);
    start(() => router.replace(`${pathname}${p.size ? `?${p}` : ""}`, { scroll: false }));
  };

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => go(value, filter), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- debounce on typing only
  }, [value]);

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <label className="relative flex-1">
          <span className="sr-only">Search customers</span>
          {pending ? (
            <Loader2 className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 animate-spin text-ink-muted" />
          ) : (
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-muted" />
          )}
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Name, phone or email"
            className="h-10 w-full rounded-full border border-line bg-surface pr-9 pl-10 text-sm text-ink outline-none placeholder:text-ink-muted focus:border-forest-fg focus:ring-2 focus:ring-forest/15"
          />
          {value && (
            <button
              type="button"
              onClick={() => setValue("")}
              aria-label="Clear search"
              className="absolute top-1/2 right-2 grid size-6 -translate-y-1/2 place-items-center rounded-full text-ink-muted hover:bg-khaki-soft"
            >
              <X className="size-3.5" />
            </button>
          )}
        </label>
        <a
          href={exportHref}
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-line bg-surface px-4 text-sm font-semibold text-forest-fg hover:bg-khaki-soft"
        >
          <Download className="size-4" />
          <span className="hidden sm:inline">Export CSV</span>
        </a>
      </div>
      <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
        <div className="flex w-max gap-2">
          {filters.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={filter === f.id}
              onClick={() => go(value, f.id)}
              className={cn(
                "inline-flex h-8 items-center rounded-full border px-3 text-xs font-semibold whitespace-nowrap transition-colors",
                filter === f.id ? "border-forest bg-forest text-white" : "border-line bg-surface text-ink-muted hover:text-forest-fg",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
