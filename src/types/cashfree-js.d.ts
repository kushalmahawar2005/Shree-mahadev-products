// Minimal types for @cashfreepayments/cashfree-js (the package ships none).
declare module "@cashfreepayments/cashfree-js" {
  export type CashfreeCheckoutResult = {
    error?: { message?: string; code?: string };
    redirect?: boolean;
    paymentDetails?: { paymentMessage?: string };
  };
  export type Cashfree = {
    checkout(options: { paymentSessionId: string; redirectTarget?: "_self" | "_blank" | "_top" | "_modal" | HTMLElement }): Promise<CashfreeCheckoutResult>;
  };
  export function load(options: { mode: "sandbox" | "production" }): Promise<Cashfree | null>;
}
