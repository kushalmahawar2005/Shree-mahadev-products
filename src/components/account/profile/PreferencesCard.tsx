"use client";

import { useState } from "react";
import { BellRing, Mail, MessageCircle, MessageSquareText, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/shadcn/switch";
import {
  setLanguageAction,
  setPreferenceAction,
} from "@/lib/account/profile-actions";
import { cn } from "@/lib/utils/cn";
import { SectionCard } from "./parts";

type PrefKey = "wa_orders" | "sms_orders" | "wa_offers" | "email_offers";
type Prefs = Record<PrefKey, boolean>;

const ROWS: { key: PrefKey; icon: LucideIcon; title: string; hint: string }[] = [
  {
    key: "wa_orders",
    icon: MessageCircle,
    title: "Order updates on WhatsApp",
    hint: "Packed, shipped and delivered. Critical messages (payment, cancellation) are always sent.",
  },
  {
    key: "sms_orders",
    icon: MessageSquareText,
    title: "Order updates on SMS",
    hint: "Short text updates when your order moves.",
  },
  {
    key: "wa_offers",
    icon: Sparkles,
    title: "Offers & new batches on WhatsApp",
    hint: "Fresh ghani batches and festive offers. A few messages a month.",
  },
  {
    key: "email_offers",
    icon: Mail,
    title: "Offers on email",
    hint: "Recipes, offers and new products.",
  },
];

export function PreferencesCard({
  initial,
  language: initialLanguage,
  hasEmail,
}: {
  initial: Prefs;
  language: "en" | "hi";
  hasEmail: boolean;
}) {
  const [prefs, setPrefs] = useState(initial);
  const [busy, setBusy] = useState<PrefKey | null>(null);
  const [language, setLanguage] = useState(initialLanguage);
  const [status, setStatus] = useState("");

  const toggle = async (key: PrefKey, value: boolean) => {
    setPrefs((p) => ({ ...p, [key]: value })); // optimistic
    setBusy(key);
    const r = await setPreferenceAction({ key, value }).catch(() => ({ ok: false as const, error: "Could not save. Check your connection." }));
    setBusy(null);
    const title = ROWS.find((x) => x.key === key)!.title;
    if (!r.ok) {
      setPrefs((p) => ({ ...p, [key]: !value })); // revert
      toast.error(r.error);
      setStatus(`${title}: not saved`);
      return;
    }
    setStatus(`${title} turned ${value ? "on" : "off"}`);
  };

  const pickLanguage = async (next: "en" | "hi") => {
    if (next === language) return;
    const prev = language;
    setLanguage(next);
    const r = await setLanguageAction({ language: next }).catch(() => ({ ok: false as const, error: "Could not save. Check your connection." }));
    if (!r.ok) {
      setLanguage(prev);
      toast.error(r.error);
      return;
    }
    setStatus(next === "hi" ? "Messages will be in Hindi" : "Messages will be in English");
  };

  return (
    <SectionCard
      id="preferences"
      icon={BellRing}
      title="Communication preferences"
      hint="Changes save instantly."
    >
      <ul className="divide-y divide-line">
        {ROWS.map(({ key, icon: Icon, title, hint }) => {
          const disabled = key === "email_offers" && !hasEmail;
          const id = `pref-${key}`;
          return (
            <li key={key} className="flex min-h-14 items-center gap-3 py-3 first:pt-0 last:pb-0">
              <Icon className="size-5 shrink-0 text-co-accent" strokeWidth={1.75} aria-hidden />
              <label htmlFor={id} className={cn("min-w-0 flex-1", disabled ? "cursor-not-allowed" : "cursor-pointer")}>
                <span className="block text-base font-semibold text-ink">{title}</span>
                <span className="block text-sm text-ink-muted">
                  {disabled ? "Add an email in Personal details to turn this on." : hint}
                </span>
              </label>
              <span className="grid min-h-11 min-w-11 place-items-center">
                <Switch
                  id={id}
                  checked={prefs[key]}
                  disabled={disabled || busy === key}
                  onCheckedChange={(v) => toggle(key, v)}
                  className="data-[state=checked]:bg-co-success"
                />
              </span>
            </li>
          );
        })}
      </ul>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
        <div>
          <p className="text-base font-semibold text-ink">Message language</p>
          <p className="text-sm text-ink-muted">For WhatsApp and SMS updates.</p>
        </div>
        <div role="radiogroup" aria-label="Message language" className="inline-flex rounded-full border border-line bg-co-panel p-1">
          {(
            [
              ["en", "English"],
              ["hi", "हिंदी"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={language === value}
              lang={value}
              onClick={() => pickLanguage(value)}
              className={cn(
                "h-10 min-w-20 rounded-full px-4 text-sm font-semibold transition",
                value === "hi" && "font-hindi",
                language === value ? "bg-white text-ink shadow-co-card" : "text-ink-muted hover:text-ink",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <p aria-live="polite" className="sr-only">
        {status}
      </p>
    </SectionCard>
  );
}
