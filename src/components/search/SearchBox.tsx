"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";

const MIN_CHARS = 3;
const DEBOUNCE_MS = 350;

/**
 * Search-as-you-type for /search: after 3+ characters the results update on their own
 * (debounced, URL kept in sync with router.replace). Enter / the button still submit at once,
 * and the form works without JS as a plain GET to /search.
 */
export function SearchBox({ q }: { q: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [value, setValue] = useState(q);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  // Chip links and back/forward change ?q= from outside: mirror it into the box.
  // Our own debounced updates must not overwrite letters typed while the results were loading.
  const [prevQ, setPrevQ] = useState(q);
  const [sent, setSent] = useState(q);
  if (q !== prevQ) {
    setPrevQ(q);
    if (q !== sent) {
      setSent(q);
      setValue(q);
    }
  }

  function go(next: string) {
    const term = next.trim();
    if (term === q) return; // already showing these results
    setSent(term);
    startTransition(() => {
      router.replace(term ? `${pathname}?q=${encodeURIComponent(term)}` : pathname, { scroll: false });
    });
  }

  useEffect(() => {
    const term = value.trim();
    // Short partial words would flash "nothing found"; wait for 3+ characters (or a cleared box).
    if (term.length > 0 && term.length < MIN_CHARS) return;
    const t = setTimeout(() => go(term), DEBOUNCE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- go is stable enough; only typing should re-arm the timer
  }, [value]);

  return (
    <form
      action="/search"
      role="search"
      className="relative mt-5 md:mt-6"
      onSubmit={(e) => {
        e.preventDefault();
        go(value);
        inputRef.current?.blur(); // close the phone keyboard so results are visible
      }}
    >
      <label htmlFor="q" className="sr-only">
        Search products
      </label>
      {pending ? (
        <Loader2 className="pointer-events-none absolute top-1/2 left-5 size-5 -translate-y-1/2 animate-spin text-forest" aria-hidden />
      ) : (
        <Search className="pointer-events-none absolute top-1/2 left-5 size-5 -translate-y-1/2 text-ink-muted" aria-hidden />
      )}
      <input
        ref={inputRef}
        id="q"
        name="q"
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Try mustard, honey, baby massage"
        autoFocus={!q}
        autoComplete="off"
        enterKeyHint="search"
        maxLength={80}
        aria-busy={pending}
        className="h-14 w-full rounded-full border border-line bg-white pr-[120px] pl-13 text-base text-ink shadow-[0_14px_30px_-24px_rgba(7,47,27,0.5)] outline-none transition-[border-color,box-shadow] placeholder:text-ink-muted/60 focus:border-forest focus:ring-4 focus:ring-forest/10 md:pr-36 [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => {
            setValue("");
            inputRef.current?.focus();
          }}
          className="absolute top-1/2 right-[92px] grid size-8 -translate-y-1/2 place-items-center rounded-full text-ink-muted hover:bg-khaki-soft hover:text-ink md:right-[108px]"
          aria-label="Clear search"
        >
          <X className="size-4" />
        </button>
      )}
      <button type="submit" className="absolute top-1.5 right-1.5 h-11 rounded-full bg-forest px-5 text-sm font-bold text-white hover:bg-forest-mid md:px-6">
        Search
      </button>
    </form>
  );
}
