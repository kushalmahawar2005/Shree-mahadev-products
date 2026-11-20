import "server-only";
import { cashfreeConfigured, cashfreeMode } from "./cashfree";
import { payuConfigured, payuIsTest } from "./payu";
import { getStoreSettings } from "./store-settings";

export type Gateway = "payu" | "cashfree";

export const GATEWAY_LABEL: Record<Gateway, string> = { payu: "PayU", cashfree: "Cashfree" };

/** True when payments through this gateway are test/sandbox payments (no real money moves). */
export function gatewayIsTest(provider: string) {
  return provider === "cashfree" ? cashfreeMode() !== "production" : payuIsTest();
}

/** Gateway for new online payments: the admin's choice, or the other one if the chosen one has no keys. Null = none set up. */
export async function activeGateway(): Promise<Gateway | null> {
  const want = (await getStoreSettings()).paymentGateway;
  const ok: Record<Gateway, boolean> = { payu: payuConfigured(), cashfree: cashfreeConfigured() };
  if (ok[want]) return want;
  if (ok.payu) return "payu";
  if (ok.cashfree) return "cashfree";
  return null;
}
