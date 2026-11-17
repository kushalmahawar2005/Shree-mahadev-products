"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import { LoaderCircle, X } from "lucide-react";
import { spring, ease } from "@/components/chat/motion";
import { addressSchema } from "@/components/account/addresses/schema";
import { saveAddressAction } from "@/lib/account/address-actions";
import { lookupPincodeAction } from "@/lib/checkout-actions";
import { INDIAN_STATES } from "@/lib/checkout";

type Fields = { name: string; phone: string; pincode: string; line1: string; landmark: string; city: string; state: string; makeDefault: boolean };
const EMPTY: Fields = { name: "", phone: "", pincode: "", line1: "", landmark: "", city: "", state: "", makeDefault: true };

/** Hinglish versions of the address form's validation messages. */
const MESSAGES: Record<string, string> = {
  pincode: "6 ank ka pincode daaliye.",
  name: "Poora naam daaliye.",
  phone: "10 ank ka mobile number daaliye (6–9 se shuru).",
  line1: "Makaan no., building aur gali daaliye.",
  city: "City daaliye.",
  state: "State chuniye.",
};

const input = "h-12 w-full rounded-xl border border-line bg-white px-3.5 text-[16px] outline-none transition-[border-color,box-shadow] placeholder:text-ink-muted focus:border-forest/50 focus:ring-2 focus:ring-forest/10 aria-[invalid=true]:border-alert";

/**
 * Bottom sheet inside the chat panel for adding a delivery address. Data goes straight to the
 * existing address API (saveAddressAction); it never enters the chat transcript or the AI prompt.
 */
export function AddressSheet({ container, onClose, onSaved }: { container: HTMLElement | null; onClose: () => void; onSaved: () => void }) {
  const [values, setValues] = useState<Fields>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof Fields, string>>>({});
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState("");
  const [lookingUp, setLookingUp] = useState(false);

  const set = (key: keyof Fields, value: string | boolean) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  async function onPincode(value: string) {
    const pin = value.replace(/\D/g, "").slice(0, 6);
    set("pincode", pin);
    if (pin.length !== 6) return;
    setLookingUp(true);
    const found = await lookupPincodeAction(pin).catch(() => null);
    setLookingUp(false);
    if (found) setValues((current) => ({ ...current, city: current.city || found.city, state: current.state || found.state }));
  }

  async function save() {
    setServerError("");
    const parsed = addressSchema.safeParse({ ...values, label: "home" });
    if (!parsed.success) {
      const next: Partial<Record<keyof Fields, string>> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0]) as keyof Fields;
        next[key] ??= MESSAGES[key] ?? issue.message;
      }
      setErrors(next);
      return;
    }
    setSaving(true);
    const result = await saveAddressAction({ address: parsed.data }).catch(() => ({ ok: false as const, error: "Network issue. Dobara try karein." }));
    setSaving(false);
    if (!result.ok) { setServerError(result.error); return; }
    onSaved();
  }

  if (!container) return null;
  const field = (key: keyof Fields, label: string, props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <label className="block">
      <span className="mb-1 block text-[12.5px] font-medium text-ink">{label}</span>
      <input {...props} value={String(values[key])} aria-invalid={Boolean(errors[key])} onChange={(event) => (key === "pincode" ? void onPincode(event.target.value) : set(key, event.target.value))} className={input} />
      {errors[key] && <span className="mt-1 block text-[12.5px] text-alert">{errors[key]}</span>}
    </label>
  );

  return createPortal(
    <div className="absolute inset-0 z-30 flex flex-col justify-end" data-chat-keep>
      <motion.button type="button" aria-label="Close address form" onClick={onClose} className="absolute inset-0 bg-black/35" initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { duration: 0.2, ease: ease.outQuart } }} exit={{ opacity: 0 }} />
      <motion.div
        role="dialog"
        aria-label="Naya address"
        className="relative max-h-[88%] overflow-y-auto rounded-t-[20px] bg-ivory px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-2 shadow-[0_-12px_40px_rgba(7,47,27,.2)]"
        initial={{ y: "100%" }}
        animate={{ y: 0, transition: spring.panel }}
        exit={{ y: "100%", transition: { duration: 0.2, ease: ease.inQuart } }}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.6 }}
        onDragEnd={(_, info) => { if (info.offset.y > 120) onClose(); }}
      >
        <span aria-hidden className="mx-auto mb-2 block h-1.5 w-10 rounded-full bg-line" />
        <div className="mb-3 flex items-center justify-between">
          <p className="text-base font-semibold text-ink">Naya delivery address</p>
          <button type="button" onClick={onClose} aria-label="Close" className="grid size-11 place-items-center rounded-full text-ink-muted hover:bg-co-panel"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          {field("name", "Poora naam", { autoComplete: "name", placeholder: "Jaise Ramesh Kumar" })}
          {field("phone", "Mobile number", { autoComplete: "tel-national", inputMode: "numeric", maxLength: 10, placeholder: "10 ank" })}
          <div className="relative">
            {field("pincode", "Pincode", { autoComplete: "postal-code", inputMode: "numeric", maxLength: 6, placeholder: "6 ank" })}
            {lookingUp && <LoaderCircle size={16} className="absolute right-3 top-[38px] animate-spin text-ink-muted" />}
          </div>
          {field("line1", "Makaan / gali", { autoComplete: "address-line1", placeholder: "House no., building, street" })}
          {field("landmark", "Area / landmark (optional)", { autoComplete: "address-line2" })}
          <div className="grid grid-cols-2 gap-2">
            {field("city", "City", { autoComplete: "address-level2" })}
            <label className="block">
              <span className="mb-1 block text-[12.5px] font-medium text-ink">State</span>
              <select value={values.state} aria-invalid={Boolean(errors.state)} onChange={(event) => set("state", event.target.value)} autoComplete="address-level1" className={input}>
                <option value="">Chuniye</option>
                {INDIAN_STATES.map((state) => <option key={state}>{state}</option>)}
              </select>
              {errors.state && <span className="mt-1 block text-[12.5px] text-alert">{errors.state}</span>}
            </label>
          </div>
          <label className="flex min-h-11 items-center justify-between rounded-xl border border-line bg-white px-3.5 text-sm text-ink">
            Default bana dein
            <input type="checkbox" checked={values.makeDefault} onChange={(event) => set("makeDefault", event.target.checked)} className="size-5 accent-[var(--color-forest)]" />
          </label>
          {serverError && <p className="rounded-xl bg-alert-soft px-3 py-2 text-sm text-alert" role="alert">{serverError}</p>}
          <motion.button whileTap={{ scale: 0.97, transition: spring.press }} type="button" disabled={saving} onClick={() => void save()} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-forest text-[15px] font-semibold text-white transition-colors hover:bg-forest-mid disabled:opacity-60">
            {saving && <LoaderCircle size={16} className="animate-spin" />}Address save karein
          </motion.button>
        </div>
      </motion.div>
    </div>,
    container,
  );
}
