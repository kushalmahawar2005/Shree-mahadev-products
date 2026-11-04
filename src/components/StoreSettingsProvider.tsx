"use client";

import { createContext, useContext } from "react";
import { DEFAULT_SETTINGS, type StoreSettings } from "@/lib/store-settings";

const Ctx = createContext<StoreSettings>(DEFAULT_SETTINGS);

export function StoreSettingsProvider({ value, children }: { value: StoreSettings; children: React.ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Live store settings in client components (free-shipping threshold, COD, contact...). */
export const useStoreSettings = () => useContext(Ctx);
