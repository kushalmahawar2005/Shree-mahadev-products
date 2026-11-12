"use client";

import Image, { type ImageProps } from "next/image";
import { useState } from "react";
import { PRODUCT_PLACEHOLDER } from "@/lib/placeholder";

/** next/image that falls back to the branded placeholder once when its source fails. */
export function FallbackImage({ onError, ...props }: ImageProps) {
  const src = typeof props.src === "string" ? props.src : "";
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const failed = !!src && failedSrc === src && src !== PRODUCT_PLACEHOLDER;
  return (
    <Image
      {...props}
      src={failed ? PRODUCT_PLACEHOLDER : props.src}
      unoptimized={failed || props.unoptimized}
      alt={props.alt}
      onError={(e) => {
        if (src) setFailedSrc(src);
        onError?.(e);
      }}
    />
  );
}
