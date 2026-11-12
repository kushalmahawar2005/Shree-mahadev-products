"use client";

import { createContext, useContext, useMemo, useState } from "react";

type Value = { size?: string; setSize: (size: string) => void };
const Ctx = createContext<Value>({ setSize: () => {} });

/** Shares the chosen size (e.g. "2 L") between the buy box and the gallery, so the photo follows the size. */
export function VariantImageProvider({ children }: { children: React.ReactNode }) {
  const [size, setSize] = useState<string>();
  const value = useMemo(() => ({ size, setSize }), [size]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useVariantImage = () => useContext(Ctx);
