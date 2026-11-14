"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/cn";

/** Plays a YouTube embed filling its (9:16) box; fades in once loaded. */
export function ReelFrame({ src, title, className, onLoad }: { src: string; title: string; className?: string; onLoad?: () => void }) {
  const [ready, setReady] = useState(false);
  return (
    <div className={cn("absolute inset-0 overflow-hidden bg-black", className)}>
      <iframe
        src={src}
        title={title}
        allow="autoplay; encrypted-media; picture-in-picture"
        allowFullScreen
        onLoad={() => (setReady(true), onLoad?.())}
        className={cn("absolute inset-0 size-full border-0 transition-opacity duration-300", ready ? "opacity-100" : "opacity-0")}
      />
    </div>
  );
}
