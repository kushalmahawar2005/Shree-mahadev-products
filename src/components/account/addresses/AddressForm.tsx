"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Briefcase, Check, Home, Loader2, MapPin, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { Input } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import { Skeleton } from "@/components/shadcn/skeleton";
import { Switch } from "@/components/shadcn/switch";
import {
  checkAddressPincodeAction,
  saveAddressAction,
  type PincodeCheck,
} from "@/lib/account/address-actions";
import { cn } from "@/lib/utils/cn";
import {
  addressSchema,
  LABEL_TEXT,
  LABELS,
  type AddressFormValues,
  type AddressView,
  type Label as AddressLabel,
} from "./schema";

const INPUT =
  "h-12 rounded-xl border-line bg-white px-4 text-base shadow-none md:text-base focus-visible:border-forest focus-visible:ring-4 focus-visible:ring-forest/10 aria-invalid:border-co-danger aria-invalid:ring-co-danger/10";

const LABEL_ICON: Record<AddressLabel, typeof Home> = {
  home: Home,
  work: Briefcase,
  other: MapPin,
};
const PIN = /^[1-9]\d{5}$/;

function Field({
  label,
  error,
  hint,
  className,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  className?: string;
  children: (id: string, invalid: boolean) => React.ReactNode;
}) {
  const id = useId();
  return (
    <div className={className}>
      <Label htmlFor={id} className="mb-1.5 text-[13px] font-medium text-ink-muted">
        {label}
      </Label>
      {children(id, !!error)}
      {error ? (
        <p className="mt-1.5 text-xs font-medium text-co-danger">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-ink-muted">{hint}</p>
      ) : null}
    </div>
  );
}

/**
 * Add / edit an address. Pincode first: city and state fill in from it (never overwriting what
 * the shopper typed) and we show whether couriers deliver there.
 */
export function AddressForm({
  initial,
  isFirst,
  onDone,
  onCancel,
}: {
  initial?: AddressView;
  /** No saved addresses yet: this one becomes the default automatically. */
  isFirst: boolean;
  onDone: () => void;
  onCancel: () => void;
}) {
  const lockedDefault = isFirst || !!initial?.isDefault;
  const {
    register,
    handleSubmit,
    control,
    setValue,
    getValues,
    setFocus,
    formState: { errors },
  } = useForm<AddressFormValues>({
    resolver: zodResolver(addressSchema),
    mode: "onTouched",
    defaultValues: {
      pincode: initial?.pincode ?? "",
      name: initial?.name ?? "",
      phone: initial?.phone ?? "",
      line1: initial ? [initial.line1, initial.line2].filter(Boolean).join(", ") : "",
      landmark: initial?.landmark ?? "",
      city: initial?.city ?? "",
      state: initial?.state ?? "",
      label: initial?.label ?? "home",
      makeDefault: lockedDefault,
    },
  });
  const [saving, start] = useTransition();
  const [serverError, setServerError] = useState("");

  // ---- Pincode → city/state + serviceability (debounced, like checkout) ----
  const pincode = useWatch({ control, name: "pincode" }) ?? "";
  const pinKey = PIN.test(pincode) ? pincode : "";
  const [checked, setChecked] = useState<{ pin: string; r: PincodeCheck } | null>(null);
  const autoFilled = useRef({ city: "", state: "" });

  useEffect(() => {
    if (!pinKey) return;
    let live = true;
    const t = setTimeout(async () => {
      const r = await checkAddressPincodeAction(pinKey).catch(
        (): PincodeCheck => ({ ok: false }),
      );
      if (!live) return;
      setChecked({ pin: pinKey, r });
      if (!r.ok) return;
      const cur = getValues();
      if (r.city && (!cur.city || cur.city === autoFilled.current.city)) {
        setValue("city", r.city, { shouldValidate: true });
        autoFilled.current.city = r.city;
      }
      if (r.state && (!cur.state || cur.state === autoFilled.current.state)) {
        setValue("state", r.state, { shouldValidate: true });
        autoFilled.current.state = r.state;
      }
    }, 300);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [pinKey, getValues, setValue]);

  const check = checked && checked.pin === pinKey ? checked.r : null;
  const checking = !!pinKey && !check;

  const onSubmit = handleSubmit(
    (values) => {
      setServerError("");
      start(async () => {
        const r = await saveAddressAction({ id: initial?.id, address: values }).catch(() => ({
          ok: false as const,
          error: "Could not save. Check your connection and try again.",
        }));
        if (!r.ok) {
          setServerError(r.error);
          toast.error(r.error);
          return;
        }
        toast.success(initial ? "Address updated" : "Address saved");
        onDone();
      });
    },
    (errs) => {
      const first = (Object.keys(errs) as (keyof AddressFormValues)[])[0];
      if (first && first !== "label" && first !== "makeDefault") setFocus(first);
    },
  );

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <div>
        <Field label="Pincode" error={errors.pincode?.message} className="sm:max-w-[240px]">
          {(id, invalid) => (
            <Input
              id={id}
              inputMode="numeric"
              autoComplete="postal-code"
              maxLength={6}
              placeholder="6-digit pincode"
              autoFocus={!initial}
              aria-invalid={invalid}
              className={cn(INPUT, "tracking-[0.2em] placeholder:tracking-normal")}
              {...register("pincode", {
                onChange: (e) =>
                  (e.target.value = e.target.value.replace(/\D/g, "").slice(0, 6)),
              })}
            />
          )}
        </Field>
        <PincodeNote checking={checking} check={check} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
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
            <Input
              id={id}
              autoComplete="address-level1"
              aria-invalid={invalid}
              className={INPUT}
              {...register("state")}
            />
          )}
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
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
        <Field label="Mobile number" error={errors.phone?.message}>
          {(id, invalid) => (
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-base text-ink-muted">
                +91
              </span>
              <Input
                id={id}
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                maxLength={10}
                placeholder="10-digit mobile"
                aria-invalid={invalid}
                className={cn(INPUT, "pl-14")}
                {...register("phone", {
                  onChange: (e) =>
                    (e.target.value = e.target.value
                      .replace(/\D/g, "")
                      .replace(/^(91|0)(?=\d{10}$)/, "")
                      .slice(0, 10)),
                })}
              />
            </div>
          )}
        </Field>
      </div>

      <Field label="House no., building, street, area" error={errors.line1?.message}>
        {(id, invalid) => (
          <Input
            id={id}
            autoComplete="street-address"
            aria-invalid={invalid}
            className={INPUT}
            {...register("line1")}
          />
        )}
      </Field>

      <Field label="Landmark (optional)" error={errors.landmark?.message}>
        {(id, invalid) => (
          <Input
            id={id}
            placeholder="e.g. Near Shiv Mandir"
            aria-invalid={invalid}
            className={INPUT}
            {...register("landmark")}
          />
        )}
      </Field>

      <div>
        <p id="addr-label" className="mb-1.5 text-[13px] font-medium text-ink-muted">
          Save as
        </p>
        <Controller
          control={control}
          name="label"
          render={({ field }) => (
            <div
              role="radiogroup"
              aria-labelledby="addr-label"
              className="inline-flex rounded-full border border-line bg-page p-1"
            >
              {LABELS.map((l) => {
                const Icon = LABEL_ICON[l];
                const on = field.value === l;
                return (
                  <button
                    key={l}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => field.onChange(l)}
                    className={cn(
                      "relative inline-flex h-11 items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition-colors",
                      on ? "text-ink" : "text-ink-muted hover:text-ink",
                    )}
                  >
                    {on && (
                      <motion.span
                        layoutId="addr-label-pill"
                        className="absolute inset-0 rounded-full bg-white shadow-co-card ring-1 ring-line"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.35 }}
                      />
                    )}
                    <Icon className="relative size-4" />
                    <span className="relative">{LABEL_TEXT[l]}</span>
                  </button>
                );
              })}
            </div>
          )}
        />
      </div>

      <Controller
        control={control}
        name="makeDefault"
        render={({ field }) => (
          <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4 rounded-2xl border border-line bg-page px-4 py-3">
            <span>
              <span className="block text-sm font-semibold text-ink">Make this my default</span>
              <span className="block text-xs text-ink-muted">
                {isFirst
                  ? "Your first address becomes the default automatically."
                  : initial?.isDefault
                    ? "This is your default address. Set another as default to change it."
                    : "Used first at checkout."}
              </span>
            </span>
            <Switch
              checked={field.value}
              onCheckedChange={field.onChange}
              disabled={lockedDefault}
              className="data-[state=checked]:bg-forest"
            />
          </label>
        )}
      />

      {serverError && (
        <p role="alert" className="rounded-xl bg-co-danger/10 px-4 py-3 text-sm font-medium text-co-danger">
          {serverError}
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="h-12 rounded-xl border border-line bg-white px-5 text-sm font-semibold text-ink hover:bg-page"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-forest px-6 text-sm font-semibold text-white hover:bg-forest-mid disabled:opacity-60"
        >
          {saving && <Loader2 className="size-4 animate-spin" />}
          {saving ? "Saving…" : initial ? "Save changes" : "Save address"}
        </button>
      </div>
    </form>
  );
}

function PincodeNote({ checking, check }: { checking: boolean; check: PincodeCheck | null }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      {checking ? (
        <motion.div key="l" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-2.5">
          <Skeleton className="h-8 w-64 max-w-full rounded-full bg-co-accent-soft" />
        </motion.div>
      ) : check?.ok && check.serviceable ? (
        <motion.p
          key="ok"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="mt-2.5 inline-flex items-center gap-2 rounded-full bg-co-success-soft px-3.5 py-1.5 text-sm font-medium text-co-success"
        >
          <Check className="size-4" strokeWidth={3} />
          We deliver here · usually {check.eta}
        </motion.p>
      ) : check?.ok ? (
        <motion.p
          key="no"
          role="alert"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="mt-2.5 inline-flex items-center gap-2 rounded-full bg-co-danger/10 px-3.5 py-1.5 text-sm font-medium text-co-danger"
        >
          <X className="size-4" strokeWidth={3} /> Not serviceable yet
        </motion.p>
      ) : null}
    </AnimatePresence>
  );
}
