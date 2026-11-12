"use client";

import Image from "next/image";
import Link from "next/link";
import {
  startTransition,
  useActionState,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
} from "react";
import { useForm, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AnimatePresence, motion } from "motion/react";
import NumberFlow from "@number-flow/react";
import {
  Check,
  ChevronDown,
  Loader2,
  Minus,
  PartyPopper,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import {
  Banknote,
  CreditCard,
  Lock,
  ShieldCheck,
  TicketPercent,
  Truck,
} from "@/components/icons/duo";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/shadcn/collapsible";
import { Input } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import { Skeleton } from "@/components/shadcn/skeleton";
import { useCart } from "@/components/cart/CartProvider";
import { CART_COUPON_KEY, PayULogo } from "@/components/cart/CartDrawer";
import { PaymentLogos } from "@/components/layout/PaymentLogos";
import {
  AddMoreSheet,
  type CatalogItem,
} from "@/components/checkout/AddMoreSheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/shadcn/alert-dialog";
import { useStoreSettings } from "@/components/StoreSettingsProvider";
import { checkoutConfig } from "@/config/checkout";
import { INDIAN_STATES } from "@/lib/checkout";
import {
  lookupPincodeAction,
  placeOrderAction,
  quoteShippingAction,
  saveCheckoutContactAction,
  type CheckoutState,
  type ShippingQuoteResult,
} from "@/lib/checkout-actions";
import { validateCheckoutCouponAction } from "@/lib/coupon-actions";
import { cutoutUrl } from "@/lib/image-loader";
import { formatMoney } from "@/lib/utils/money";
import { cn } from "@/lib/utils/cn";

export type SavedAddress = {
  name: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PIN = /^[1-9]\d{5}$/;
const GSTIN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const schema = z.object({
  name: z.string().trim().min(2, "Please enter your full name.").max(120),
  phone: z
    .string()
    .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile number."),
  email: z
    .string()
    .trim()
    .max(160)
    .refine(
      (e) => !e || EMAIL.test(e),
      "Enter a valid email or leave it empty.",
    ),
  // Optional business GSTIN, printed on the tax invoice.
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .refine((v) => !v || GSTIN.test(v), "GSTIN has 15 characters, e.g. 08ABCDE1234F1Z5."),
  pincode: z.string().regex(PIN, "Enter a 6-digit pincode."),
  line1: z
    .string()
    .trim()
    .min(5, "Enter house no., building and street.")
    .max(255),
  line2: z.string().trim().max(255),
  city: z.string().trim().min(2, "Enter your city.").max(80),
  state: z
    .string()
    .refine(
      (v) => (INDIAN_STATES as readonly string[]).includes(v),
      "Select your state.",
    ),
});
type Values = z.infer<typeof schema>;
type Key = keyof Values;
type SectionId = "contact" | "address" | "payment";

const CONTACT: Key[] = ["name", "phone", "email", "gstin"];
const ADDRESS: Key[] = ["pincode", "line1", "line2", "city", "state"];
const ORDER: Key[] = ["phone", "name", "email", "gstin", ...ADDRESS];
const sectionOf = (k: Key): SectionId =>
  CONTACT.includes(k) ? "contact" : "address";
const DRAFT_KEY = "smp_checkout_draft";
const EMPTY: Values = {
  name: "",
  phone: "",
  email: "",
  gstin: "",
  pincode: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
};
const NF = {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
} as const;
const NO_DELIVERY = "Sorry, we don't deliver to this pincode yet.";

const digits10 = (p: string) =>
  p
    .replace(/\D/g, "")
    .replace(/^(91|0)(?=\d{10}$)/, "")
    .slice(0, 10);
/** "bhawar badi bijainagar, rajasthan" → "Bhawar Badi Bijainagar, Rajasthan" (emails untouched). */
const titleCase = (t: string) =>
  t
    .replace(/\s+,/g, ",")
    .replace(/,(?=\S)/g, ", ")
    .split(" ")
    .map((w) =>
      w.includes("@")
        ? w
        : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(),
    )
    .join(" ");
const shortTitle = (t: string) => t.replace(/^(Wood|Cold)-Pressed\s+/, "");

function etaLabel(days: number | null) {
  if (!days)
    return `Delivers in ${checkoutConfig.fallbackEtaDays.min}–${checkoutConfig.fallbackEtaDays.max} days`;
  const d = new Date();
  d.setDate(d.getDate() + days + 1); // +1 day to pack and hand over
  if (d.getDay() === 0) d.setDate(d.getDate() + 1); // couriers don't deliver on Sunday
  return `Delivers by ${new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short" }).format(d)}`;
}

/** Hides the sticky pay bar while the on-screen keyboard is up (it would cover the input). */
function useKeyboardOpen() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const f = () => setOpen(window.innerHeight - vv.height > 160);
    vv.addEventListener("resize", f);
    return () => vv.removeEventListener("resize", f);
  }, []);
  return open;
}

export function CheckoutForm({
  titlesHi,
  catalog,
  customer,
  addresses,
}: {
  titlesHi: Record<string, string>;
  catalog: CatalogItem[];
  customer: { name: string; phone: string; email: string } | null;
  addresses: SavedAddress[];
}) {
  const { shipping: ship } = useStoreSettings();
  const { cart, update, remove } = useCart();
  // Rows added from "Add more": flash them in the summary when the sheet closes.
  const [highlight, setHighlight] = useState<string[]>([]);
  const flashRows = (ids: string[]) => {
    if (!ids.length) return;
    setHighlight(ids);
    setTimeout(() => setHighlight([]), 1800);
  };
  // Removing the last item empties the order: confirm first.
  const [confirmLast, setConfirmLast] = useState<string | null>(null);
  const removeLine = async (lineId: string) => {
    if ((cart?.lines.length ?? 0) <= 1) setConfirmLast(lineId);
    else await remove(lineId);
  };
  const [localError, setLocalError] = useState("");
  const summaryRef = useRef<HTMLDivElement>(null);
  const [summaryFits, setSummaryFits] = useState(true);
  useEffect(() => {
    const el = summaryRef.current;
    if (!el) return;
    const check = () =>
      setSummaryFits(el.offsetHeight + 96 + 24 <= window.innerHeight);
    const ro = new ResizeObserver(check);
    ro.observe(el);
    window.addEventListener("resize", check);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", check);
    };
  }, []);
  const [state, placeOrder, placing] = useActionState<CheckoutState, FormData>(
    placeOrderAction,
    undefined,
  );
  const payUrl = state?.payUrl;

  const firstAddr = addresses[0];
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: {
      ...EMPTY,
      name: customer?.name ?? firstAddr?.name ?? "",
      phone: digits10(customer?.phone ?? firstAddr?.phone ?? ""),
      email: customer?.email ?? "",
      ...(firstAddr
        ? {
            pincode: firstAddr.pincode,
            line1: firstAddr.line1,
            line2: firstAddr.line2,
            city: firstAddr.city,
            state: firstAddr.state,
          }
        : {}),
    },
  });
  const {
    register,
    formState,
    setValue,
    getValues,
    trigger,
    setFocus,
    setError,
    watch,
  } = form;
  const errors = formState.errors;

  const [open, setOpen] = useState<SectionId>("contact");
  const [done, setDone] = useState<Record<SectionId, boolean>>({
    contact: false,
    address: false,
    payment: false,
  });
  const [savedPick, setSavedPick] = useState<number | "new">(
    firstAddr ? 0 : "new",
  );
  const [chosenMethod, setMethod] = useState<"payu" | "cod">("payu");
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const keyboardOpen = useKeyboardOpen();

  // ---- Shipping quote + pincode autofill -------------------------------------------------
  const v = watch();
  const pincode = v.pincode ?? "";
  const [quoted, setQuoted] = useState<{
    key: string;
    q: ShippingQuoteResult;
  } | null>(null);
  const autoFilled = useRef({ city: "", state: "" });
  const cartKey = cart ? `${cart.subtotal.amount}|${cart.totalQuantity}` : "";
  const quoteKey = PIN.test(pincode) && cartKey ? `${pincode}|${cartKey}` : "";

  useEffect(() => {
    if (!quoteKey) return;
    let live = true;
    const pin = quoteKey.slice(0, 6);
    const t = setTimeout(async () => {
      const [q, place] = await Promise.all([
        quoteShippingAction(pin),
        lookupPincodeAction(pin),
      ]);
      if (!live) return;
      setQuoted({ key: quoteKey, q });
      // Fill city/state from the pincode, but never overwrite what the shopper typed themselves.
      if (place) {
        const cur = getValues();
        if (place.city && (!cur.city || cur.city === autoFilled.current.city)) {
          setValue("city", place.city, { shouldValidate: true });
          autoFilled.current.city = place.city;
        }
        if (
          place.state &&
          (!cur.state || cur.state === autoFilled.current.state)
        ) {
          setValue("state", place.state, { shouldValidate: true });
          autoFilled.current.state = place.state;
        }
      }
    }, 300);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [quoteKey, getValues, setValue]);

  const quote = quoted && quoted.key === quoteKey ? quoted.q : null;
  const quoting = !!quoteKey && !quote;
  const okQuote = quote?.ok && quote.serviceable ? quote : null;
  const serviceable = !!okQuote;
  const notServiceable = quote?.ok === true && !quote.serviceable;

  // ---- Draft (localStorage, never the payment choice) --------------------------------------
  useEffect(() => {
    let draft: Partial<Values> = {};
    try {
      draft = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "{}") ?? {};
    } catch {}
    const raf = requestAnimationFrame(() => {
      for (const k of ORDER) {
        const val = draft[k];
        if (typeof val === "string" && val && !getValues(k))
          setValue(k, k === "phone" ? digits10(val) : val);
      }
      // Already complete (returning shopper / refresh): collapse straight to the next step.
      const vals = getValues();
      const contactOk = schema
        .pick({ name: true, phone: true, email: true, gstin: true })
        .safeParse(vals).success;
      const addressOk = schema
        .pick({
          pincode: true,
          line1: true,
          line2: true,
          city: true,
          state: true,
        })
        .safeParse(vals).success;
      setDone({
        contact: contactOk,
        address: contactOk && addressOk,
        payment: false,
      });
      setOpen(!contactOk ? "contact" : !addressOk ? "address" : "payment");
      void trigger(undefined, { shouldFocus: false }).then(() =>
        form.clearErrors(),
      );
    });
    const sub = watch((val) => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(val));
      } catch {}
    });
    return () => {
      cancelAnimationFrame(raf);
      sub.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once on mount
  }, []);

  // ---- Coupon ----------------------------------------------------------------------------
  const [couponCode, setCouponCode] = useState("");
  const [applied, setApplied] = useState<{
    code: string;
    discount: number;
    freeShipping: boolean;
  } | null>(null);
  const [couponError, setCouponError] = useState("");
  const [couponPending, startCoupon] = useTransition();
  function applyCoupon(codeArg?: string) {
    const code = (codeArg ?? couponCode).trim();
    if (!code) return;
    setCouponError("");
    startCoupon(async () => {
      const result = await validateCheckoutCouponAction({
        code,
        phone: getValues("phone"),
      });
      if (!result.ok) {
        setApplied(null);
        setCouponError(result.error ?? "This code can't be applied.");
        return;
      }
      setCouponCode(result.code);
      setApplied({
        code: result.code,
        discount: result.discount,
        freeShipping: result.freeShipping,
      });
    });
  }
  // Code chosen in the cart drawer: prefill, apply once a valid mobile is there (per-phone rules).
  const pendingCartCode = useRef("");
  useEffect(() => {
    let code = "";
    try {
      code = sessionStorage.getItem(CART_COUPON_KEY) ?? "";
    } catch {}
    if (!code) return;
    pendingCartCode.current = code;
    const raf = requestAnimationFrame(() => setCouponCode(code));
    return () => cancelAnimationFrame(raf);
  }, []);
  useEffect(() => {
    if (!pendingCartCode.current || !/^[6-9]\d{9}$/.test(v.phone ?? "")) return;
    const c = pendingCartCode.current;
    pendingCartCode.current = "";
    applyCoupon(c);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- applyCoupon reads current state
  }, [v.phone]);
  // Cart changed (qty / remove): the coupon value depends on it, so price it again.
  const lastCartKey = useRef(cartKey);
  useEffect(() => {
    if (lastCartKey.current && cartKey !== lastCartKey.current && applied)
      applyCoupon(applied.code);
    lastCartKey.current = cartKey;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-run only when the cart changes
  }, [cartKey]);

  // ---- Totals ----------------------------------------------------------------------------
  const lines = cart?.lines ?? [];
  const subtotal = cart?.subtotal.amount ?? 0;
  const mrpTotal = lines.reduce(
    (s, l) =>
      s +
      Math.max(l.variant.compareAtPrice?.amount ?? 0, l.variant.price.amount) *
        l.quantity,
    0,
  );
  const discount = applied?.discount ?? 0;

  const codCapOk = !ship.codMaxOrder || subtotal - discount <= ship.codMaxOrder;
  const codForPin = !!okQuote && okQuote.cod.shipping >= 0;
  const codAllowed = ship.codEnabled && codForPin && codCapOk;
  const codReason = !codCapOk
    ? `COD is available on orders up to ${formatMoney(ship.codMaxOrder ?? 0)}`
    : !quote?.ok
      ? "Enter your pincode to check COD"
      : !codForPin
        ? "COD not available for this pincode"
        : "";
  const method = codAllowed ? chosenMethod : "payu";

  const shipKnown = okQuote
    ? method === "cod"
      ? okQuote.cod.shipping
      : okQuote.payu.shipping
    : null;
  const shipping =
    shipKnown === null ? null : applied?.freeShipping ? 0 : shipKnown;
  const codFee = okQuote && method === "cod" ? okQuote.cod.codFee : 0;
  const prepaidPct: number = checkoutConfig.prepaidDiscountPercent;
  const prepaidOff =
    method === "payu" && prepaidPct > 0
      ? Math.round(((subtotal - discount) * prepaidPct) / 100)
      : 0;
  const total =
    Math.max(0, subtotal - discount - prepaidOff) + (shipping ?? 0) + codFee;
  const youSave = mrpTotal - subtotal + discount + prepaidOff;
  const unavailable = lines.filter((l) => !l.variant.availableForSale);
  const ready =
    formState.isValid && serviceable && lines.length > 0 && !unavailable.length;

  // Qty changes / adds that cross free shipping or the COD cap: say so briefly, next to the totals.
  const [notice, setNotice] = useState<string | null>(null);
  const freeNow = subtotal >= ship.freeShippingThreshold;
  const prevFlags = useRef<{ free: boolean; cod: boolean } | null>(null);
  useEffect(() => {
    if (!cart) return;
    const prev = prevFlags.current;
    prevFlags.current = { free: freeNow, cod: codCapOk };
    if (!prev) return;
    let msg: string | null = null;
    if (!prev.free && freeNow) msg = "🎉 Free shipping unlocked";
    else if (prev.free && !freeNow)
      msg = `Shipping now applies (free above ${formatMoney(ship.freeShippingThreshold)})`;
    else if (prev.cod && !codCapOk && ship.codEnabled)
      msg = `COD isn't available above ${formatMoney(ship.codMaxOrder ?? 0)}. Pay online instead.`;
    else if (!prev.cod && codCapOk && ship.codEnabled)
      msg = "Cash on delivery is available again";
    if (!msg) return;
    const show = requestAnimationFrame(() => setNotice(msg));
    const hide = setTimeout(() => setNotice(null), 5000);
    return () => {
      cancelAnimationFrame(show);
      clearTimeout(hide);
    };
  }, [
    cart,
    freeNow,
    codCapOk,
    ship.freeShippingThreshold,
    ship.codMaxOrder,
    ship.codEnabled,
  ]);

  // ---- Sections --------------------------------------------------------------------------
  async function next(from: "contact" | "address") {
    const ok = await trigger(from === "contact" ? CONTACT : ADDRESS, {
      shouldFocus: true,
    });
    if (!ok) return;
    if (from === "address" && !serviceable) {
      if (notServiceable) setError("pincode", { message: NO_DELIVERY });
      return;
    }
    const nowDone = { ...done, [from]: true };
    setDone(nowDone);
    setOpen(from === "contact" && !nowDone.address ? "address" : "payment");
  }

  function pickSaved(i: number | "new") {
    setSavedPick(i);
    const a = i === "new" ? null : addresses[i];
    for (const k of ADDRESS)
      setValue(k, a ? a[k as keyof SavedAddress] : "", { shouldValidate: !!a });
    autoFilled.current = { city: "", state: "" };
  }

  // ---- Submit ----------------------------------------------------------------------------
  function focusFirst(errs: FieldErrors<Values>) {
    const first = ORDER.find((k) => errs[k]);
    if (!first) return;
    setOpen(sectionOf(first));
    setTimeout(() => {
      setFocus(first);
      document
        .getElementsByName(first)[0]
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 320); // after the section has opened
  }
  const onValid = (vals: Values) => {
    if (unavailable.length) {
      setLocalError(
        `${shortTitle(unavailable[0].product.title)} (${unavailable[0].variant.title}) is out of stock. Remove it to continue.`,
      );
      setSummaryOpen(true);
      return;
    }
    setLocalError("");
    if (!serviceable) {
      if (notServiceable) setError("pincode", { message: NO_DELIVERY });
      focusFirst({ pincode: { type: "manual" } });
      return;
    }
    const fd = new FormData();
    for (const k of ORDER) fd.set(k, vals[k]);
    fd.set("method", method);
    fd.set("couponCode", applied?.code ?? "");
    startTransition(() => placeOrder(fd));
  };
  const submit = form.handleSubmit(onValid, (errs) => {
    setAttempted(true);
    focusFirst(errs);
  });

  // Server-side validation errors land back on the fields.
  useEffect(() => {
    const fe = state?.fieldErrors;
    if (!fe) return;
    for (const [k, msg] of Object.entries(fe))
      if (msg && k !== "method") setError(k as Key, { message: msg });
    const first = ORDER.find((k) => fe[k]);
    const raf = requestAnimationFrame(() => {
      if (first) focusFirst({ [first]: { type: "server" } });
      else if (fe.method) setOpen("payment");
    });
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- react to a new server response only
  }, [state]);

  // Full page load to the PayU hand-off page (see placeOrderAction).
  useEffect(() => {
    if (payUrl) window.location.assign(payUrl);
  }, [payUrl]);

  const busy = placing || !!payUrl;
  const ctaLabel = busy
    ? "Placing order…"
    : method === "cod"
      ? `Place order · ${formatMoney(total)} (pay on delivery)`
      : `Pay ${formatMoney(total)} securely`;
  const errorList = attempted
    ? ORDER.filter((k) => errors[k]).map((k) => errors[k]?.message)
    : [];

  const summaryProps: SummaryProps = {
    lines,
    titlesHi,
    loading: !cart,
    update,
    remove: removeLine,
    highlight,
    notice,
    coupon: {
      code: couponCode,
      setCode: setCouponCode,
      applied,
      error: couponError,
      pending: couponPending,
      apply: () => applyCoupon(),
      clear: () => {
        setApplied(null);
        setCouponCode("");
        setCouponError("");
      },
      setError: setCouponError,
    },
    totals: {
      subtotal,
      mrpTotal,
      discount,
      shipping,
      quoting,
      codFee,
      prepaidOff,
      total,
      youSave,
      freeAt: ship.freeShippingThreshold,
    },
    delivery: okQuote ? `${etaLabel(okQuote.etaDays)} to ${pincode}` : null,
  };

  if (cart && !lines.length) {
    return (
      <div className="mx-auto mt-6 max-w-lg rounded-3xl border border-line bg-white px-6 py-14 text-center">
        <p className="text-lg font-bold text-forest-text">Your cart is empty</p>
        <Link
          href="/shop"
          className="mt-5 inline-flex h-12 items-center rounded-full bg-forest px-7 text-sm font-bold text-white"
        >
          Shop oils
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      onBlur={() =>
        void saveCheckoutContactAction({
          name: getValues("name"),
          phone: getValues("phone"),
          email: getValues("email"),
          pincode: getValues("pincode"),
        })
      }
      className="grid grid-cols-[minmax(0,1fr)] gap-5 pb-6 lg:grid-cols-12 lg:gap-8 lg:pb-0"
    >
      {/* Mobile: collapsible order summary */}
      <Collapsible
        open={summaryOpen}
        onOpenChange={setSummaryOpen}
        className="overflow-hidden rounded-2xl border border-line bg-white shadow-co-card lg:hidden"
      >
        <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left">
          <span className="flex items-center gap-2 text-sm font-semibold text-forest-text">
            {summaryOpen ? "Hide" : "Show"} order summary
            <ChevronDown
              className={cn(
                "size-4 transition-transform",
                summaryOpen && "rotate-180",
              )}
            />
          </span>
          <span className="text-lg font-extrabold text-ink tabular-nums">
            <NumberFlow value={total} format={NF} locales="en-IN" />
          </span>
        </CollapsibleTrigger>
        <CollapsibleContent className="border-t border-line">
          <div className="flex justify-end px-3 pt-2">
            <AddMoreSheet catalog={catalog} onClosed={flashRows} />
          </div>
          <Summary {...summaryProps} />
        </CollapsibleContent>
      </Collapsible>

      <div className="space-y-4 lg:col-span-7">
        <Progress done={done} open={open} />

        {errorList.length > 0 && (
          <div role="alert" className="sr-only">
            Please fix {errorList.length} field{errorList.length > 1 ? "s" : ""}
            : {errorList.join(" ")}
          </div>
        )}

        {/* 1 + 2 done: one compact review card (Shopify-style) instead of two collapsed cards */}
        {done.contact && done.address && open === "payment" ? (
          <div className="divide-y divide-line rounded-3xl border border-line bg-white shadow-co-card px-5 md:px-6">
            <ReviewRow
              label="Contact"
              value={[titleCase(v.name), `+91 ${v.phone}`, v.email].filter(Boolean)}
              onChange={() => setOpen("contact")}
            />
            <ReviewRow
              label="Ship to"
              value={titleCase(
                [v.line1, v.line2, `${v.city}, ${v.state} ${v.pincode}`]
                  .filter(Boolean)
                  .join(", "),
              )}
              onChange={() => setOpen("address")}
            />
          </div>
        ) : (
          <>
            {/* 1 · Contact */}
            <Section
              n={1}
              title="Contact"
              hint="Order updates on WhatsApp / SMS"
              open={open === "contact"}
              done={done.contact}
              summary={`${titleCase(v.name)} · +91 ${v.phone}${v.email ? ` · ${v.email}` : ""}`}
              onEdit={() => setOpen("contact")}
            >
              {customer && (
                <p className="mb-4 flex flex-wrap items-center gap-x-2 rounded-xl bg-co-brand-soft px-3.5 py-2.5 text-sm text-ink">
                  Logged in as{" "}
                  <b>{customer.name || `+91 ${digits10(customer.phone)}`}</b>
                  <Link
                    href="/account"
                    className="font-semibold text-forest underline-offset-2 hover:underline"
                  >
                    Change
                  </Link>
                </p>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Mobile number"
                  error={errors.phone?.message}
                  className="sm:col-span-2"
                >
                  {(id, invalid) => (
                    <div className="relative">
                      <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center border-r border-line pr-3 pl-4 text-base font-semibold text-ink-muted">
                        +91
                      </span>
                      <Input
                        id={id}
                        type="tel"
                        inputMode="numeric"
                        autoComplete="tel-national"
                        placeholder="10-digit mobile number"
                        maxLength={10}
                        aria-invalid={invalid}
                        className={cn(INPUT, "pl-[4.25rem] tracking-wide")}
                        {...register("phone", {
                          onChange: (e) =>
                            (e.target.value = digits10(e.target.value)),
                        })}
                      />
                    </div>
                  )}
                </Field>
                <Field label="Full name" error={errors.name?.message}>
                  {(id, invalid) => (
                    <Input
                      id={id}
                      autoComplete="name"
                      aria-invalid={invalid}
                      className={INPUT}
                      {...register("name")}
                    />
                  )}
                </Field>
                <Field label="Email (optional)" error={errors.email?.message}>
                  {(id, invalid) => (
                    <Input
                      id={id}
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      placeholder="For the invoice"
                      aria-invalid={invalid}
                      className={INPUT}
                      {...register("email")}
                    />
                  )}
                </Field>
                <details
                  className="group sm:col-span-2"
                  open={!!getValues("gstin") || !!errors.gstin}
                >
                  <summary className="w-fit cursor-pointer list-none text-[13px] font-semibold text-forest underline-offset-2 hover:underline [&::-webkit-details-marker]:hidden">
                    Buying for a business? Add GSTIN
                  </summary>
                  <Field
                    label="GSTIN (optional)"
                    error={errors.gstin?.message}
                    className="mt-3 sm:max-w-[calc(50%-0.5rem)]"
                  >
                    {(id, invalid) => (
                      <Input
                        id={id}
                        autoComplete="off"
                        autoCapitalize="characters"
                        maxLength={15}
                        placeholder="Printed on your tax invoice"
                        aria-invalid={invalid}
                        className={cn(INPUT, "uppercase")}
                        {...register("gstin")}
                      />
                    )}
                  </Field>
                </details>
              </div>
              <ContinueButton onClick={() => next("contact")}>
                Continue to address
              </ContinueButton>
            </Section>

            {/* 2 · Address */}
            <Section
              n={2}
              title="Delivery address"
              hint="Pincode first: we'll fill in city and state"
              open={open === "address"}
              done={done.address}
              summary={titleCase(
                [v.line1, v.line2, `${v.city}, ${v.state} ${v.pincode}`]
                  .filter(Boolean)
                  .join(", "),
              )}
              onEdit={() => setOpen("address")}
            >
              {addresses.length > 0 && (
                <div
                  className="mb-5 grid gap-2.5 sm:grid-cols-2"
                  role="radiogroup"
                  aria-label="Saved addresses"
                >
                  {addresses.map((a, i) => (
                    <RadioCard
                      key={i}
                      on={savedPick === i}
                      onSelect={() => pickSaved(i)}
                    >
                      <span className="block text-sm font-semibold text-forest-text">
                        {a.name}
                      </span>
                      <span className="mt-0.5 line-clamp-2 block text-xs text-ink-muted">
                        {a.line1}, {a.city}, {a.state} {a.pincode}
                      </span>
                    </RadioCard>
                  ))}
                  <RadioCard
                    on={savedPick === "new"}
                    onSelect={() => pickSaved("new")}
                  >
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-forest-text">
                      <Plus className="size-4" /> Add new address
                    </span>
                    <span className="mt-0.5 block text-xs text-ink-muted">
                      Saved to your account with the order
                    </span>
                  </RadioCard>
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Field
                    label="Pincode"
                    error={errors.pincode?.message}
                    className="sm:max-w-[240px]"
                  >
                    {(id, invalid) => (
                      <Input
                        id={id}
                        inputMode="numeric"
                        autoComplete="postal-code"
                        maxLength={6}
                        placeholder="6-digit pincode"
                        aria-invalid={invalid || notServiceable}
                        className={cn(
                          INPUT,
                          "tracking-[0.2em] placeholder:tracking-normal",
                        )}
                        {...register("pincode", {
                          onChange: (e) =>
                            (e.target.value = e.target.value
                              .replace(/\D/g, "")
                              .slice(0, 6)),
                        })}
                      />
                    )}
                  </Field>
                  <DeliveryNote
                    quoting={quoting}
                    quote={quote}
                    free={applied?.freeShipping}
                  />
                </div>
                <Field
                  label="House no., building, street"
                  error={errors.line1?.message}
                  className="sm:col-span-2"
                >
                  {(id, invalid) => (
                    <Input
                      id={id}
                      autoComplete="address-line1"
                      aria-invalid={invalid}
                      className={INPUT}
                      {...register("line1")}
                    />
                  )}
                </Field>
                <Field
                  label="Area, landmark (optional)"
                  className="sm:col-span-2"
                >
                  {(id) => (
                    <Input
                      id={id}
                      autoComplete="address-line2"
                      className={INPUT}
                      {...register("line2")}
                    />
                  )}
                </Field>
                <Field label="City" error={errors.city?.message}>
                  {(id, invalid) => (
                    <Input
                      id={id}
                      autoComplete="address-level2"
                      aria-invalid={invalid}
                      className={INPUT}
                      {...register("city")}
                    />
                  )}
                </Field>
                <Field label="State" error={errors.state?.message}>
                  {(id, invalid) => (
                    <select
                      id={id}
                      autoComplete="address-level1"
                      aria-invalid={invalid}
                      className={cn(
                        "h-12 w-full appearance-none rounded-xl border border-line bg-white bg-[url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%235c5a52%22 stroke-width=%222%22%3E%3Cpath d=%22M6 9l6 6 6-6%22/%3E%3C/svg%3E')] bg-[length:16px] bg-[right_14px_center] bg-no-repeat px-4 pr-10 text-base outline-none focus-visible:border-forest focus-visible:ring-4 focus-visible:ring-forest/10 aria-invalid:border-alert",
                      )}
                      {...register("state")}
                    >
                      <option value="" disabled>
                        Select state
                      </option>
                      {INDIAN_STATES.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  )}
                </Field>
              </div>
              <ContinueButton
                onClick={() => next("address")}
                disabled={quoting || notServiceable}
              >
                Continue to payment
              </ContinueButton>
            </Section>
          </>
        )}

        {/* 3 · Payment */}
        <Section
          n={3}
          title="Payment"
          hint="Encrypted and processed by PayU"
          open={open === "payment"}
          done={false}
          summary=""
          onEdit={() => setOpen("payment")}
        >
          <div
            className="grid gap-3"
            role="radiogroup"
            aria-label="Payment method"
          >
            <PayCard
              on={method === "payu"}
              onSelect={() => setMethod("payu")}
              icon={CreditCard}
              title="Pay online"
              note="UPI, cards, net banking, wallets"
              badge={
                prepaidOff > 0
                  ? `Save ${formatMoney(prepaidOff)}`
                  : "Recommended · Instant UPI"
              }
            >
              <PaymentLogos
                only={[
                  "UPI",
                  "Google Pay",
                  "PhonePe",
                  "Visa",
                  "Mastercard",
                  "RuPay",
                ]}
                size="sm"
              />
            </PayCard>
            {ship.codEnabled && (
              <PayCard
                on={method === "cod"}
                disabled={!codAllowed}
                onSelect={() => setMethod("cod")}
                icon={Banknote}
                title="Cash on delivery"
                note={
                  !codAllowed
                    ? codReason
                    : okQuote && okQuote.cod.codFee > 0
                      ? `+ ${formatMoney(okQuote.cod.codFee)} COD charge`
                      : "Pay when your order arrives"
                }
              >
                <PaymentLogos only={["Cash on delivery"]} size="sm" />
              </PayCard>
            )}
          </div>
          {state?.fieldErrors?.method && (
            <p className="mt-3 text-sm text-alert">
              {state.fieldErrors.method}
            </p>
          )}
        </Section>

        {/* The natural next step after choosing how to pay: same handler/state as the summary button. */}
        <div className="hidden pt-1 lg:block">
          {(localError || state?.error) && (
            <p
              role="alert"
              className="mb-3 rounded-xl bg-alert-soft p-3 text-sm text-alert"
            >
              {localError || state?.error}
            </p>
          )}
          <PayButton
            busy={busy}
            ready={ready}
            label={ctaLabel}
            logos={method === "payu"}
          />
          <TrustRow />
        </div>
      </div>

      {/* Desktop: sticky summary */}
      {/* Sticky only while the whole card fits under the 72px header (+24px gaps); else it scrolls with the page. */}
      <aside
        className={cn(
          "hidden h-fit lg:col-span-5 lg:block",
          summaryFits && "lg:sticky lg:top-24",
        )}
      >
        <div
          ref={summaryRef}
          className="rounded-3xl border border-line bg-white shadow-co-card"
        >
          <div className="flex shrink-0 items-center justify-between px-6 pt-5 pb-3">
            <h2 className="flex items-center gap-2 text-lg text-ink">
              Order summary
              <span className="rounded-full border border-line bg-white px-2 py-0.5 text-xs font-semibold text-ink-muted">
                {cart?.totalQuantity ?? 0} item
                {cart?.totalQuantity === 1 ? "" : "s"}
              </span>
            </h2>
            <AddMoreSheet
              catalog={catalog}
              className="-mr-2.5"
              onClosed={flashRows}
            />
          </div>
          <Summary {...summaryProps} split>
            <div className="px-6 pt-0.5 pb-4">
              {(localError || state?.error) && (
                <p
                  role="alert"
                  className="mb-3 rounded-xl bg-alert-soft p-3 text-sm text-alert"
                >
                  {localError || state?.error}
                </p>
              )}
              <PayButton
                busy={busy}
                ready={ready}
                label={ctaLabel}
                logos={method === "payu"}
              />
              <TrustRow />
            </div>
          </Summary>
        </div>
      </aside>

      <div className="lg:hidden">
        <TrustRow />
      </div>

      <AlertDialog
        open={!!confirmLast}
        onOpenChange={(o) => !o && setConfirmLast(null)}
      >
        <AlertDialogContent className="co-theme">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove last item?</AlertDialogTitle>
            <AlertDialogDescription>
              Your cart will be empty and this checkout will close.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              className="bg-co-danger text-white hover:bg-co-danger/90"
              onClick={() => {
                if (confirmLast) void remove(confirmLast);
                setConfirmLast(null);
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Mobile: sticky pay bar */}
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_-16px_rgba(0,0,0,0.25)] backdrop-blur transition-transform duration-200 lg:hidden",
          keyboardOpen && "translate-y-full",
        )}
      >
        {(localError || state?.error) && (
          <p role="alert" className="mb-2 text-xs text-alert">
            {localError || state?.error}
          </p>
        )}
        <div className="flex items-center gap-3">
          <div className="min-w-0">
            <p className="text-[11px] text-ink-muted">
              {method === "cod" ? "Pay on delivery" : "Total"}
            </p>
            <p className="text-xl leading-tight font-extrabold text-ink tabular-nums">
              <NumberFlow value={total} format={NF} locales="en-IN" />
            </p>
          </div>
          <PayButton
            busy={busy}
            ready={ready}
            label={
              busy
                ? "Placing order…"
                : method === "cod"
                  ? "Place order (COD)"
                  : `Pay ${formatMoney(total)} securely`
            }
            compact
          />
        </div>
      </div>
    </form>
  );
}

const INPUT =
  "h-12 rounded-xl border-line bg-white px-4 text-base shadow-none md:text-base focus-visible:border-forest focus-visible:ring-4 focus-visible:ring-forest/10 aria-invalid:border-alert aria-invalid:ring-alert/10";

function Field({
  label,
  error,
  className,
  children,
}: {
  label: string;
  error?: string;
  className?: string;
  children: (id: string, invalid: boolean) => React.ReactNode;
}) {
  const id = useId();
  return (
    <div className={className}>
      <Label
        htmlFor={id}
        className="mb-1.5 text-[13px] font-medium text-ink-muted"
      >
        {label}
      </Label>
      {children(id, !!error)}
      {error && (
        <p className="mt-1.5 text-xs font-medium text-alert">{error}</p>
      )}
    </div>
  );
}

function Progress({
  done,
  open,
}: {
  done: Record<SectionId, boolean>;
  open: SectionId;
}) {
  const steps: [SectionId, string][] = [
    ["contact", "Contact"],
    ["address", "Address"],
    ["payment", "Payment"],
  ];
  return (
    <ol
      className="flex items-center gap-2 px-1 text-xs font-semibold"
      aria-label="Checkout progress"
    >
      {steps.map(([id, label], i) => (
        <li key={id} className="flex flex-1 items-center gap-2 last:flex-none">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 whitespace-nowrap",
              done[id]
                ? "text-forest"
                : open === id
                  ? "text-forest-text"
                  : "text-ink-muted",
            )}
          >
            <span
              className={cn(
                "grid size-5 place-items-center rounded-full text-[10px]",
                done[id]
                  ? "bg-forest text-white"
                  : open === id
                    ? "border-2 border-forest text-forest"
                    : "border border-co-border-strong",
              )}
            >
              {done[id] ? <Check className="size-3" strokeWidth={3} /> : i + 1}
            </span>
            {label}
          </span>
          {i < steps.length - 1 && (
            <span className="h-0.5 flex-1 overflow-hidden rounded-full bg-co-border-strong/60">
              <motion.span
                className="block h-full bg-forest"
                initial={false}
                animate={{ width: done[id] ? "100%" : "0%" }}
                transition={{ duration: 0.4 }}
              />
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}

function Section({
  n,
  title,
  hint,
  open,
  done,
  summary,
  onEdit,
  children,
}: {
  n: number;
  title: string;
  hint: string;
  open: boolean;
  done: boolean;
  summary: string;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-3xl border bg-white shadow-co-card transition-colors",
        open ? "border-co-border-strong" : "border-line",
      )}
    >
      <header className="flex items-center gap-3 p-5 md:px-6">
        <span
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-full text-sm font-bold",
            done && !open
              ? "bg-co-brand-soft text-forest"
              : open
                ? "bg-co-brand-soft text-forest ring-1 ring-forest/25"
                : "border border-co-border-strong text-ink-muted",
          )}
        >
          {done && !open ? <Check className="size-4" strokeWidth={3} /> : n}
        </span>
        <div className="min-w-0 flex-1">
          <h2
            className={cn(
              "flex items-center gap-2 text-lg text-ink",
              !open && !done && "text-ink-muted",
            )}
          >
            {title}
          </h2>
          {open ? (
            <p className="text-xs text-ink-muted">{hint}</p>
          ) : done && summary ? (
            <p className="truncate text-sm text-ink-muted">{summary}</p>
          ) : null}
        </div>
        {!open && done && (
          <button
            type="button"
            onClick={onEdit}
            className="shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold text-forest hover:bg-khaki-soft"
          >
            Edit
          </button>
        )}
      </header>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="px-5 pt-1 pb-6 md:px-6">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function ContinueButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="mt-5 inline-flex h-12 w-full items-center justify-center rounded-xl border-[1.5px] border-forest bg-co-brand-soft px-6 text-sm font-bold text-forest transition-colors hover:bg-forest hover:text-white disabled:opacity-50 sm:w-auto"
    >
      {children}
    </button>
  );
}

function DeliveryNote({
  quoting,
  quote,
  free,
}: {
  quoting: boolean;
  quote: ShippingQuoteResult | null;
  free?: boolean;
}) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      {quoting ? (
        <motion.div
          key="l"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="mt-2.5"
        >
          <Skeleton className="h-8 w-64 max-w-full rounded-full bg-khaki-soft" />
        </motion.div>
      ) : quote?.ok && quote.serviceable ? (
        <motion.p
          key="ok"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="mt-2.5 inline-flex flex-wrap items-center gap-x-2 gap-y-1 rounded-full bg-co-success-soft px-3.5 py-1.5 text-sm font-medium text-co-success"
        >
          <Check className="size-4" strokeWidth={3} />
          {etaLabel(quote.etaDays)}
          <span className="opacity-40">·</span>
          {free || quote.payu.shipping === 0 ? (
            <b>FREE shipping</b>
          ) : (
            `Shipping ${formatMoney(quote.payu.shipping)}`
          )}
        </motion.p>
      ) : quote?.ok ? (
        <motion.p
          key="no"
          role="alert"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="mt-2.5 inline-flex items-center gap-2 rounded-full bg-alert-soft px-3.5 py-1.5 text-sm font-medium text-alert"
        >
          <X className="size-4" strokeWidth={3} /> Sorry, we don&apos;t deliver
          here yet
        </motion.p>
      ) : null}
    </AnimatePresence>
  );
}

function RadioCard({
  on,
  onSelect,
  children,
}: {
  on: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onSelect}
      className={cn(
        "flex items-start gap-3 rounded-2xl border-[1.5px] p-3.5 text-left transition-colors",
        on
          ? "border-forest bg-co-brand-soft"
          : "border-line bg-white hover:border-co-border-strong",
      )}
    >
      <span
        className={cn(
          "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2",
          on ? "border-forest bg-forest text-white" : "border-line",
        )}
      >
        {on && <Check className="size-3" strokeWidth={3} />}
      </span>
      <span className="min-w-0">{children}</span>
    </button>
  );
}

function PayCard({
  on,
  disabled,
  onSelect,
  icon: I,
  title,
  note,
  badge,
  children,
}: {
  on: boolean;
  disabled?: boolean;
  onSelect: () => void;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  note: string;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      aria-disabled={disabled}
      onClick={() => !disabled && onSelect()}
      className={cn(
        "relative flex flex-col gap-3 rounded-2xl border-[1.5px] p-4 text-left transition-all sm:flex-row sm:items-center sm:justify-between",
        disabled
          ? "cursor-not-allowed border-line bg-page"
          : on
            ? "border-forest bg-co-brand-soft"
            : "border-line bg-white hover:border-co-border-strong",
      )}
    >
      {badge && (
        <span className="absolute -top-2.5 right-4 rounded-full border border-co-accent/30 bg-co-accent-soft px-2.5 py-0.5 text-xs font-semibold text-co-accent-ink">
          {badge}
        </span>
      )}
      <span className="flex items-center gap-3 sm:flex-1">
        <span
          className={cn(
            "grid size-5 shrink-0 place-items-center rounded-full border-2",
            on ? "border-forest bg-forest text-white" : "border-line",
          )}
        >
          {on && <Check className="size-3" strokeWidth={3} />}
        </span>
        <span
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-xl",
            on
              ? "bg-white text-forest ring-1 ring-forest/15"
              : "bg-page text-forest",
            disabled && "opacity-50",
          )}
        >
          <I className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "block font-semibold text-ink",
              disabled && "opacity-60",
            )}
          >
            {title}
          </span>
          <span className="block text-xs text-ink-muted">{note}</span>
        </span>
      </span>
      <span
        className={cn(
          "block pl-8 sm:pl-0 [&_ul]:flex-wrap [&_ul]:gap-1.5",
          disabled && "opacity-50",
        )}
      >
        {children}
      </span>
    </button>
  );
}

function PayButton({
  busy,
  ready,
  label,
  compact,
  logos,
}: {
  busy: boolean;
  ready: boolean;
  label: string;
  compact?: boolean;
  logos?: boolean;
}) {
  // Not natively disabled when details are missing: pressing it takes the shopper to the first
  // missing field, which a disabled button can't do.
  return (
    <button
      type="submit"
      disabled={busy}
      className={cn(
        "btn-shine inline-flex items-center justify-center gap-2 overflow-hidden bg-forest bg-[linear-gradient(to_bottom,rgba(255,255,255,0.06),transparent)] font-bold text-white shadow-[0_10px_24px_-14px_rgba(14,59,38,0.7)] transition-[background-color,opacity,transform] outline-none hover:-translate-y-px hover:bg-forest-mid focus-visible:ring-[3px] focus-visible:ring-co-accent/40 disabled:opacity-60",
        compact
          ? "h-12 min-w-0 flex-1 rounded-2xl px-3 text-sm"
          : "h-12 w-full rounded-xl text-[15px]",
        !ready && !busy && "opacity-70",
      )}
    >
      {busy ? (
        <Loader2 className="size-5 shrink-0 animate-spin" />
      ) : (
        <Lock className="size-4 shrink-0" />
      )}
      <span className="truncate">{label}</span>
      {logos && !busy && (
        <span className="ml-1 flex items-center [&_li]:-ml-1.5 [&_li]:size-7 [&_li]:min-w-0 [&_li]:overflow-hidden [&_li]:rounded-full [&_li]:bg-white [&_li]:px-1 [&_li]:ring-1 [&_li]:ring-black/10 [&_li]:shadow-none [&_li:first-child]:ml-0 [&_svg]:!h-[7px] [&_svg]:!w-auto [&_svg]:max-w-[17px]">
          <PaymentLogos size="sm" only={["Google Pay", "PhonePe", "Paytm"]} />
        </span>
      )}
    </button>
  );
}

function TrustRow() {
  return (
    <p className="mt-2.5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-ink-muted">
      <span className="inline-flex items-center gap-1">
        <Lock className="size-3.5 text-co-accent" /> Secured by <PayULogo />
      </span>
      <span className="inline-flex items-center gap-1">
        <ShieldCheck className="size-3.5 text-co-accent" /> FSSAI licensed
      </span>
      <Link
        href="/policies/refund-return"
        className="inline-flex items-center gap-1 underline-offset-2 hover:underline"
      >
        <Truck className="size-3.5 text-co-accent" /> Easy returns
      </Link>
    </p>
  );
}

type SummaryProps = {
  lines: NonNullable<ReturnType<typeof useCart>["cart"]>["lines"];
  titlesHi: Record<string, string>;
  loading: boolean;
  update: (lineId: string, q: number) => Promise<void>;
  remove: (lineId: string) => Promise<void>;
  coupon: {
    code: string;
    setCode: (c: string) => void;
    applied: { code: string; discount: number; freeShipping: boolean } | null;
    error: string;
    pending: boolean;
    apply: () => void;
    clear: () => void;
    setError: (e: string) => void;
  };
  delivery: string | null;
  highlight: string[];
  notice: string | null;
  totals: {
    subtotal: number;
    mrpTotal: number;
    discount: number;
    shipping: number | null;
    quoting: boolean;
    codFee: number;
    prepaidOff: number;
    total: number;
    youSave: number;
    freeAt: number;
  };
};

function Summary({
  lines,
  titlesHi,
  loading,
  update,
  remove,
  coupon,
  delivery,
  highlight,
  notice,
  totals: t,
  split,
  children,
}: SummaryProps & { split?: boolean; children?: React.ReactNode }) {
  const couponId = useId();
  const [couponOpen, setCouponOpen] = useState(false);
  return (
    <div>
      {delivery && (
        <p
          className={cn(
            "flex h-9 items-center gap-2 rounded-xl bg-co-success-soft px-3.5 text-[13px] font-semibold text-co-success",
            split ? "mx-6" : "mx-5 mt-4",
          )}
        >
          <Truck className="size-4 shrink-0" />{" "}
          <span className="truncate">{delivery}</span>
        </p>
      )}
      <ItemList
        lines={lines}
        titlesHi={titlesHi}
        loading={loading}
        update={update}
        remove={remove}
        highlight={highlight}
        className={split ? "px-6" : "px-5"}
      />
      <div>
        <div
          className={cn("border-t border-line py-2", split ? "px-6" : "px-5")}
        >
          {coupon.applied ? (
            <div className="flex items-center gap-2 rounded-xl border border-dashed border-co-success/40 bg-co-success-soft px-3 py-2.5">
              <TicketPercent className="size-4 text-forest" />
              <span className="flex-1 text-sm">
                <b className="text-co-success">{coupon.applied.code}</b> applied
                {coupon.applied.discount > 0 && (
                  <span className="text-ink-muted">
                    {" "}
                    · you save {formatMoney(coupon.applied.discount)}
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={coupon.clear}
                className="grid size-7 place-items-center rounded-full text-ink-muted hover:bg-white"
                aria-label="Remove coupon"
              >
                <X className="size-4" />
              </button>
            </div>
          ) : !couponOpen && !coupon.code ? (
            <button
              type="button"
              onClick={() => setCouponOpen(true)}
              className="flex h-9 w-full items-center gap-2 text-sm font-semibold text-forest hover:underline"
            >
              <TicketPercent className="size-4 text-co-accent" /> Have a coupon
              code?
              <Plus className="ml-auto size-4 text-ink-muted" />
            </button>
          ) : (
            <div className="flex gap-2">
              <Label htmlFor={couponId} className="sr-only">
                Coupon code
              </Label>
              <div className="relative flex-1">
                <TicketPercent className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-muted" />
                <Input
                  id={couponId}
                  value={coupon.code}
                  onChange={(e) => {
                    coupon.setCode(e.target.value.toUpperCase());
                    coupon.setError("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      coupon.apply();
                    }
                  }}
                  placeholder="Coupon code"
                  autoComplete="off"
                  autoFocus={couponOpen}
                  className={cn(INPUT, "h-10 pl-10")}
                />
              </div>
              <button
                type="button"
                disabled={coupon.pending || !coupon.code.trim()}
                onClick={coupon.apply}
                className="h-10 rounded-xl border border-forest bg-transparent px-4 text-sm font-semibold text-forest transition-colors hover:bg-co-brand-soft disabled:border-line disabled:text-ink-muted disabled:hover:bg-transparent"
              >
                {coupon.pending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  "Apply"
                )}
              </button>
            </div>
          )}
          {coupon.error && (
            <p role="alert" className="mt-2 text-xs text-alert">
              {coupon.error}
            </p>
          )}
        </div>

        <AnimatePresence>
          {notice && (
            <motion.p
              role="status"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className={cn(
                "overflow-hidden text-[13px] font-semibold text-co-success",
                split ? "px-6" : "px-5",
              )}
            >
              <span className="mb-2 block rounded-xl bg-co-success-soft px-3 py-2">
                {notice}
              </span>
            </motion.p>
          )}
        </AnimatePresence>
        <dl
          className={cn(
            "space-y-1.5 border-t border-line text-sm",
            split ? "px-6 py-3" : "px-5 py-4",
          )}
        >
          <Row
            label="Subtotal"
            value={
              <>
                {t.mrpTotal > t.subtotal && (
                  <s className="mr-1.5 text-xs text-ink-muted/70">
                    {formatMoney(t.mrpTotal)}
                  </s>
                )}
                {formatMoney(t.subtotal)}
              </>
            }
          />
          {t.discount > 0 && (
            <Row label="Coupon" value={`−${formatMoney(t.discount)}`} accent />
          )}
          <Row
            label="Shipping"
            value={
              t.quoting
                ? "Checking…"
                : t.shipping === null
                  ? "Enter pincode"
                  : t.shipping
                    ? formatMoney(t.shipping)
                    : "FREE"
            }
            accent={t.shipping === 0}
          />
          {t.codFee > 0 && (
            <Row label="COD charge" value={formatMoney(t.codFee)} />
          )}
          {t.prepaidOff > 0 && (
            <Row
              label="Online payment discount"
              value={`−${formatMoney(t.prepaidOff)}`}
              accent
            />
          )}
          <div className="flex items-end justify-between border-t border-line pt-2.5">
            <dt>
              <span className="block font-semibold text-ink">Total</span>
              {t.youSave > 0 && (
                <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-co-success-soft px-2.5 py-0.5 text-xs font-bold text-co-success">
                  <PartyPopper className="size-3.5 text-co-accent" /> You save{" "}
                  {formatMoney(t.youSave)}
                </span>
              )}
            </dt>
            <dd className="text-right">
              <span className="text-2xl leading-none font-extrabold text-ink tabular-nums">
                <NumberFlow value={t.total} format={NF} locales="en-IN" />
              </span>
              <span className="mt-1 block text-[11px] text-ink-muted">
                Inclusive of all taxes
              </span>
            </dd>
          </div>
          {t.subtotal < t.freeAt && t.shipping !== 0 && (
            <p className="flex items-center gap-2 rounded-xl bg-co-accent-soft px-3 py-2 text-xs text-ink">
              <Truck className="size-4 shrink-0 text-co-accent" /> Add{" "}
              {formatMoney(t.freeAt - t.subtotal)} more for free shipping.
            </p>
          )}
        </dl>
        {children}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-ink-muted">{label}</dt>
      <dd
        className={cn(
          "tabular-nums",
          accent ? "font-semibold text-co-success" : "text-ink",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function ReviewRow({
  label,
  value,
  onChange,
}: {
  label: string;
  /** One string (wraps to 2 lines on phones) or one entry per line (each truncated). */
  value: string | string[];
  onChange: () => void;
}) {
  return (
    <div className="flex items-center gap-4 py-4">
      <span className="w-16 shrink-0 text-sm text-ink-muted">{label}</span>
      {Array.isArray(value) ? (
        <span className="min-w-0 flex-1 text-sm text-ink" title={value.join(" · ")}>
          {value.map((line) => (
            <span key={line} className="block truncate">
              {line}
            </span>
          ))}
        </span>
      ) : (
        <span className="line-clamp-2 min-w-0 flex-1 text-sm break-words text-ink sm:truncate" title={value}>
          {value}
        </span>
      )}
      <button
        type="button"
        onClick={onChange}
        className="shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold text-forest hover:bg-khaki-soft"
      >
        Change
      </button>
    </div>
  );
}

type CartLines = NonNullable<ReturnType<typeof useCart>["cart"]>["lines"];

/** Up to 3 rows (4 when that's all), the rest behind "Show all": no nested scroll areas. */
function ItemList({
  lines,
  titlesHi,
  loading,
  update,
  remove,
  highlight,
  className,
}: {
  lines: CartLines;
  titlesHi: Record<string, string>;
  loading: boolean;
  update: (lineId: string, q: number) => Promise<void>;
  remove: (lineId: string) => Promise<void>;
  highlight: string[];
  className?: string;
}) {
  const [all, setAll] = useState(false);
  const cut = lines.length > 4 ? 3 : lines.length;
  const rest = lines.slice(cut);
  if (loading) {
    return (
      <ul className={cn("divide-y divide-line", className)}>
        {[0, 1].map((i) => (
          <li key={i} className="flex items-center gap-3 py-3">
            <Skeleton className="size-12 rounded-xl" />
            <Skeleton className="h-9 flex-1" />
          </li>
        ))}
      </ul>
    );
  }
  const row = (l: CartLines[number]) => (
    <ItemRow
      key={l.id}
      l={l}
      hi={titlesHi[l.product.handle]}
      flash={highlight.includes(l.variant.id)}
      update={update}
      remove={remove}
    />
  );
  return (
    <div className={className}>
      <ul className="divide-y divide-line">{lines.slice(0, cut).map(row)}</ul>
      <AnimatePresence initial={false}>
        {all && rest.length > 0 && (
          <motion.ul
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="divide-y divide-line overflow-hidden border-t border-line"
          >
            {rest.map(row)}
          </motion.ul>
        )}
      </AnimatePresence>
      {rest.length > 0 && (
        <button
          type="button"
          aria-expanded={all}
          onClick={() => setAll((a) => !a)}
          className="flex w-full items-center justify-center gap-1 border-t border-line py-2.5 text-sm font-semibold text-forest hover:underline"
        >
          {all ? (
            <>
              Show less <ChevronDown className="size-4 rotate-180" />
            </>
          ) : (
            <>
              + {rest.length} more item{rest.length > 1 ? "s" : ""} · Show all{" "}
              <ChevronDown className="size-4" />
            </>
          )}
        </button>
      )}
    </div>
  );
}

function ItemRow({
  l,
  hi,
  flash,
  update,
  remove,
}: {
  l: CartLines[number];
  hi?: string;
  flash: boolean;
  update: (lineId: string, q: number) => Promise<void>;
  remove: (lineId: string) => Promise<void>;
}) {
  const img = l.product.images[0];
  const price = l.variant.price.amount;
  const mrp = l.variant.compareAtPrice?.amount ?? 0;
  const out = !l.variant.availableForSale;
  return (
    <li
      className={cn(
        "-mx-2 flex items-center gap-3 rounded-xl px-2 py-2.5",
        flash && "animate-[co-flash_1.8s_ease-out]",
      )}
    >
      <span className="relative grid size-12 shrink-0 place-items-center rounded-xl bg-white ring-1 ring-line">
        {img && (
          <Image
            src={cutoutUrl(img.url)}
            alt={img.alt}
            width={48}
            height={48}
            className="size-10 object-contain"
          />
        )}
        <span className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full bg-ink text-[10px] font-bold text-white">
          {l.quantity}
        </span>
      </span>
      <div className="min-w-0 flex-1">
        <p
          className="truncate text-sm leading-snug"
          title={`${l.product.title}${hi ? ` · ${hi}` : ""}`}
        >
          <span className="font-semibold text-ink">
            {shortTitle(l.product.title)}
          </span>
          {hi && (
            <span className="ml-1.5 text-xs text-co-accent-ink">{hi}</span>
          )}
        </p>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-xs text-ink-muted">{l.variant.title}</span>
          <span className="inline-flex h-7 items-center rounded-full border border-line">
            <button
              type="button"
              aria-label="Decrease quantity"
              disabled={l.quantity <= 1}
              onClick={() => void update(l.id, l.quantity - 1)}
              className="grid size-7 place-items-center rounded-full text-ink-muted hover:text-ink disabled:opacity-30"
            >
              <Minus className="size-3.5" />
            </button>
            <span className="w-5 text-center text-xs font-bold tabular-nums">
              {l.quantity}
            </span>
            <button
              type="button"
              aria-label="Increase quantity"
              disabled={out}
              onClick={() => void update(l.id, l.quantity + 1)}
              className="grid size-7 place-items-center rounded-full text-ink-muted hover:text-ink disabled:opacity-30"
            >
              <Plus className="size-3.5" />
            </button>
          </span>
          <button
            type="button"
            aria-label={`Remove ${l.product.title}`}
            onClick={() => void remove(l.id)}
            className="grid size-7 place-items-center rounded-full text-ink-muted hover:bg-co-danger/10 hover:text-co-danger"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
        {out && (
          <p className="mt-1 text-xs font-semibold text-co-danger">
            Out of stock. Remove it to continue.
          </p>
        )}
      </div>
      <p className="shrink-0 self-start text-right text-sm font-semibold text-ink tabular-nums">
        {formatMoney(price * l.quantity)}
        {mrp > price && (
          <s className="block text-[11px] font-normal text-ink-muted/70">
            {formatMoney(mrp * l.quantity)}
          </s>
        )}
      </p>
    </li>
  );
}
