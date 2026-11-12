"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowRight, Search } from "lucide-react";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/shadcn/command";
import { thumbUrl } from "@/lib/image-loader";
import { formatMoney } from "@/lib/utils/money";
import type { MenuProduct } from "./MegaMenu";

const shortName = (t: string) => t.replace(/^(Wood|Cold)-Pressed\s+/, "");

/**
 * Command-style search overlay (cmdk via shadcn CommandDialog), used by the compact header and on
 * phones. Matches English and Hindi names; Enter on the typed text opens the full search page.
 */
export function SearchCommand({
  open,
  onOpenChange,
  products,
  recommended,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  products: MenuProduct[];
  recommended: MenuProduct[];
}) {
  const router = useRouter();
  const go = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title="Search products" description="Search oils, honey and sweeteners" className="top-[12%] translate-y-0 rounded-2xl sm:max-w-xl">
      <CommandInput placeholder="Search for groundnut oil, raw honey…" />
      <CommandList className="max-h-[60vh]">
        <CommandEmpty>
          No match. Try &ldquo;mustard&rdquo;, &ldquo;honey&rdquo; or &ldquo;khand&rdquo;.
        </CommandEmpty>
        {recommended.length > 0 && (
          <CommandGroup heading="Popular">
            {recommended.map((p) => (
              <Row key={`r-${p.handle}`} p={p} onSelect={() => go(`/products/${p.handle}`)} />
            ))}
          </CommandGroup>
        )}
        <CommandGroup heading="All products">
          {products.map((p) => (
            <Row key={p.handle} p={p} onSelect={() => go(`/products/${p.handle}`)} />
          ))}
        </CommandGroup>
        <CommandGroup heading="More">
          <CommandItem value="see all results search page" onSelect={() => go("/search")}>
            <Search className="text-forest" /> Open full search <ArrowRight className="ml-auto text-ink-muted" />
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

function Row({ p, onSelect }: { p: MenuProduct; onSelect: () => void }) {
  return (
    <CommandItem value={`${p.title} ${p.titleHi} ${p.handle}`} onSelect={onSelect} className="gap-3">
      <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-khaki-soft">
        {p.image ? <Image src={thumbUrl(p.image, 40)} alt="" width={40} height={40} unoptimized className="size-9 object-contain" /> : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-forest-text">{shortName(p.title)}</span>
        <span className="font-hindi block text-xs text-sale" lang="hi">
          {p.titleHi}
        </span>
      </span>
      {p.from ? <span className="text-xs font-semibold text-ink-muted tabular-nums">from {formatMoney(p.from)}</span> : null}
    </CommandItem>
  );
}
