"use client";

import { useState } from "react";
import { Download, PlusSquare, Share } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/shadcn/dialog";
import { usePwaInstall } from "./pwa-store";
import { cn } from "@/lib/utils/cn";

/**
 * "Install the app" entry. Android/Chrome: the browser's install dialog. iPhone Safari: a two-step guide
 * (Share → Add to Home Screen). Hidden when already installed or the browser can't install.
 */
export function InstallApp({
  className,
  onDone,
  children,
}: {
  className?: string;
  onDone?: () => void;
  /** Custom button content (default: download icon + "Install the Mahadev app"). */
  children?: React.ReactNode;
}) {
  const { state, install } = usePwaInstall();
  const [guide, setGuide] = useState(false);
  if (state === "hidden") return null;
  return (
    <>
      <button
        type="button"
        onClick={async () => {
          if (state === "ios") return setGuide(true);
          await install();
          onDone?.();
        }}
        className={cn("inline-flex items-center gap-2", className)}
      >
        {children ?? (
          <>
            <Download className="size-4" /> Install the Mahadev app
          </>
        )}
      </button>
      <Dialog open={guide} onOpenChange={setGuide}>
        <DialogContent className="max-w-sm rounded-3xl">
          <DialogTitle>Add Mahadev to your Home Screen</DialogTitle>
          <DialogDescription>Opens like an app, full screen, one tap away.</DialogDescription>
          <ol className="space-y-3 text-sm text-ink">
            <li className="flex items-center gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-khaki-soft text-forest"><Share className="size-4" /></span>
              Tap the <b>Share</b> button in Safari&apos;s bottom bar
            </li>
            <li className="flex items-center gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-khaki-soft text-forest"><PlusSquare className="size-4" /></span>
              Choose <b>Add to Home Screen</b>, then <b>Add</b>
            </li>
          </ol>
          <button type="button" onClick={() => setGuide(false)} className="mt-1 h-11 rounded-full bg-forest text-sm font-semibold text-white hover:bg-forest-mid">
            Got it
          </button>
        </DialogContent>
      </Dialog>
    </>
  );
}
