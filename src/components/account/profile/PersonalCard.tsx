"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Cake, Loader2, Mail, Pencil, UserRound } from "lucide-react";
import { toast } from "sonner";
import {
  sendEmailVerificationAction,
  updatePersonalAction,
} from "@/lib/account/profile-actions";
import { formatDateTime, formatName, initials } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import {
  Badge,
  Collapse,
  ErrorNote,
  SectionCard,
  btnGhost,
  btnPrimary,
  field,
  useUnsavedGuard,
} from "./parts";

type Gender = "female" | "male" | "other" | "na";
const GENDER_LABEL: Record<Gender, string> = {
  female: "Female",
  male: "Male",
  other: "Other",
  na: "Prefer not to say",
};

export type PersonalValues = {
  name: string;
  email: string;
  dob: string;
  gender: Gender | "";
};

export function PersonalCard({
  initial,
  emailVerified,
  today,
}: {
  initial: PersonalValues;
  emailVerified: boolean;
  today: string; // YYYY-MM-DD, IST, from the server
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(initial);
  const [error, setError] = useState("");
  const [saving, startSave] = useTransition();
  const [sending, startSend] = useTransition();

  const dirty =
    editing &&
    (form.name.trim() !== initial.name ||
      form.email.trim().toLowerCase() !== initial.email.toLowerCase() ||
      form.dob !== initial.dob ||
      form.gender !== initial.gender);
  useUnsavedGuard(dirty);

  const nameError =
    form.name.trim().length < 2
      ? "Name needs at least 2 letters."
      : form.name.trim().length > 60
        ? "Keep the name under 60 characters."
        : "";
  const emailError =
    form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())
      ? "Enter a valid email."
      : "";

  const set = <K extends keyof PersonalValues>(k: K, v: PersonalValues[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const cancel = () => {
    setForm(initial);
    setError("");
    setEditing(false);
  };

  const save = () => {
    if (nameError || emailError) {
      setError(nameError || emailError);
      return;
    }
    setError("");
    startSave(async () => {
      const r = await updatePersonalAction({
        name: form.name.trim(),
        email: form.email.trim(),
        dob: form.dob,
        gender: form.gender,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      toast.success("Details saved");
      setEditing(false);
      router.refresh();
    });
  };

  const resend = () =>
    startSend(async () => {
      const r = await sendEmailVerificationAction();
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      const devLink = r.devLink;
      toast.success(`Verification link sent to ${r.email}`, {
        description: devLink ? "Test mode: email is not sent. Open the link here." : "Check your inbox (and spam).",
        action: devLink ? { label: "Open link", onClick: () => router.push(devLink.replace(/^https?:\/\/[^/]+/, "")) } : undefined,
      });
    });

  const display = formatName(initial.name) || "Customer";

  return (
    <SectionCard
      id="personal"
      icon={UserRound}
      title="Personal details"
      hint="How we address you on orders and messages."
      action={
        !editing && (
          <button type="button" className={btnGhost} onClick={() => {
              setForm(initial);
              setEditing(true);
            }}>
            <Pencil className="size-4" /> Edit
          </button>
        )
      }
    >
      <div className="flex items-center gap-4">
        <span
          aria-hidden
          className="grid size-16 shrink-0 place-items-center rounded-full bg-forest text-xl font-bold text-white"
        >
          {initials(initial.name)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-lg font-bold text-ink">{display}</p>
          <p className="truncate text-sm text-ink-muted">
            {initial.email || "No email added"}
          </p>
        </div>
      </div>

      <Collapse show={!editing}>
        <dl className="mt-5 grid gap-x-6 gap-y-4 border-t border-line pt-5 sm:grid-cols-2">
          <Row label="Full name" value={display} />
          <div>
            <dt className="text-xs text-ink-muted">Email</dt>
            <dd className="mt-0.5 flex flex-wrap items-center gap-2 text-base text-ink">
              <span className="break-all">{initial.email || "Not added"}</span>
              {initial.email &&
                (emailVerified ? (
                  <Badge tone="success">
                    <BadgeCheck className="size-3.5" /> Verified
                  </Badge>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs">
                    <Badge tone="warn">Not verified</Badge>
                    <button
                      type="button"
                      onClick={resend}
                      disabled={sending}
                      className="inline-flex min-h-11 items-center gap-1 px-1 font-semibold text-forest underline-offset-2 hover:underline disabled:opacity-50"
                    >
                      {sending && <Loader2 className="size-3.5 animate-spin" />}
                      Resend link
                    </button>
                  </span>
                ))}
            </dd>
          </div>
          <Row
            label="Date of birth"
            value={initial.dob ? formatDateTime(`${initial.dob} 00:00:00`, { time: false }) : "Not added"}
            note={!initial.dob ? "Add it for birthday offers" : undefined}
          />
          <Row label="Gender" value={initial.gender ? GENDER_LABEL[initial.gender] : "Not added"} />
        </dl>
      </Collapse>

      <Collapse show={editing}>
        <form
          className="mt-5 space-y-4 border-t border-line pt-5"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
          noValidate
        >
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-ink">Full name</span>
            <input
              className={field}
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              autoComplete="name"
              maxLength={60}
              aria-invalid={Boolean(error && nameError) || undefined}
              required
            />
          </label>
          <label className="block">
            <span className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-ink">
              <Mail className="size-4 text-ink-muted" /> Email <span className="font-normal text-ink-muted">(optional)</span>
            </span>
            <input
              className={field}
              type="email"
              inputMode="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              autoComplete="email"
              placeholder="you@example.com"
              aria-invalid={Boolean(error && emailError) || undefined}
            />
            <span className="mt-1 block text-xs text-ink-muted">For invoices and order receipts. A new email needs to be verified again.</span>
          </label>
          <label className="block">
            <span className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-ink">
              <Cake className="size-4 text-ink-muted" /> Date of birth <span className="font-normal text-ink-muted">(optional, for birthday offers)</span>
            </span>
            <input
              className={field}
              type="date"
              value={form.dob}
              max={today}
              min="1900-01-01"
              onChange={(e) => set("dob", e.target.value)}
              autoComplete="bday"
            />
          </label>
          <fieldset>
            <legend className="mb-1.5 text-sm font-semibold text-ink">
              Gender <span className="font-normal text-ink-muted">(optional)</span>
            </legend>
            <div role="radiogroup" className="flex flex-wrap gap-2">
              {(Object.keys(GENDER_LABEL) as Gender[]).map((g) => {
                const on = form.gender === g;
                return (
                  <button
                    key={g}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => set("gender", on ? "" : g)}
                    className={cn(
                      "h-11 rounded-full border px-4 text-sm font-semibold transition",
                      on
                        ? "border-forest bg-co-brand-soft text-forest"
                        : "border-line bg-white text-ink hover:border-co-border-strong",
                    )}
                  >
                    {GENDER_LABEL[g]}
                  </button>
                );
              })}
            </div>
          </fieldset>
          <ErrorNote error={error} />
          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <button type="button" className={btnGhost} onClick={cancel} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className={btnPrimary} disabled={!dirty || saving}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              Save changes
            </button>
          </div>
        </form>
      </Collapse>
    </SectionCard>
  );
}

function Row({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div>
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="mt-0.5 text-base text-ink">{value}</dd>
      {note && <dd className="text-xs text-co-accent-ink">{note}</dd>}
    </div>
  );
}
