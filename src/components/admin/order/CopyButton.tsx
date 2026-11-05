"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/** Small copy-to-clipboard icon button with a tick for feedback. */
export function CopyButton({ value, label, className }: { value: string; label: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      aria-label={`Copy ${label}`}
      title={`Copy ${label}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          /* clipboard blocked: nothing to do */
        }
      }}
      className={cn("inline-grid size-7 place-items-center rounded-full text-ink-muted transition-colors hover:bg-khaki-soft hover:text-forest-fg", className)}
    >
      {done ? <Check className="size-3.5 text-forest-fg" /> : <Copy className="size-3.5" />}
    </button>
  );
}
