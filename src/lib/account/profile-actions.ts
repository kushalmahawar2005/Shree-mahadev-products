"use server";

import { z } from "zod";
import { clientIp, rateLimit } from "@/lib/server/rate-limit";
import {
  cleanPhone,
  clearCustomerSession,
  requireCustomer,
} from "@/lib/server/customer-auth";
import {
  GENDERS,
  PREF_KEYS,
  cancelDeletion,
  changePhone,
  checkAccountOtp,
  confirmEmailVerification,
  deleteOtherSessions,
  deleteSession,
  exportCustomerData,
  getProfile,
  issueAccountOtp,
  phoneTaken,
  queueEmailVerification,
  requestDeletion,
  setLanguage,
  setPreference,
  updatePersonal,
} from "@/lib/server/account-profile";
import { mailConfigured } from "@/lib/server/mail";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const fail = (error: string) => ({ ok: false as const, error });
const Phone = z.string().regex(/^(?:\+?91|0)?[6-9]\d{9}$/);
const Code = z.string().regex(/^\d{6}$/);

/* ───────────────────────── Personal details ───────────────────────── */

const Personal = z
  .object({
    name: z.string().trim().min(2, "Name needs at least 2 letters.").max(60, "Keep the name under 60 characters."),
    email: z
      .union([z.literal(""), z.string().trim().toLowerCase().email("Enter a valid email.").max(160)])
      .optional(),
    dob: z
      .union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid date.")])
      .optional(),
    gender: z.union([z.literal(""), z.enum(GENDERS)]).optional(),
  })
  .strict();

export async function updatePersonalAction(raw: unknown): Promise<Result> {
  const customer = await requireCustomer();
  const parsed = Personal.safeParse(raw);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the details.");
  const { name, email, dob, gender } = parsed.data;
  if (dob) {
    const d = new Date(`${dob}T00:00:00+05:30`);
    const age = (Date.now() - d.getTime()) / (365.25 * 86400000);
    if (Number.isNaN(d.getTime()) || age < 10 || age > 120)
      return fail("Please check your date of birth.");
  }
  await updatePersonal(customer.id, {
    name,
    email: email || null,
    dob: dob || null,
    gender: gender || null,
  });
  return { ok: true };
}

export async function sendEmailVerificationAction(): Promise<Result<{ devLink?: string; email: string }>> {
  const customer = await requireCustomer();
  const limit = await rateLimit("email_verify", String(customer.id), 3, 60);
  if (!limit.ok) return fail(`Too many emails sent. Try again in ${limit.retryInMin} min.`);
  const r = await queueEmailVerification(customer.id);
  if (!r.ok) return r;
  // Local testing without a mail key: hand the link back so the flow can be checked.
  const devLink = !mailConfigured() && process.env.NODE_ENV !== "production" ? r.link : undefined;
  return { ok: true, email: r.email, devLink };
}

export async function verifyEmailAction(raw: unknown): Promise<Result> {
  const customer = await requireCustomer();
  const parsed = z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{20,100}$/) }).strict().safeParse(raw);
  if (!parsed.success) return fail("This link is not valid.");
  const ok = await confirmEmailVerification(customer.id, parsed.data.token);
  return ok ? { ok: true } : fail("This link has expired or was already used. Send a new one.");
}

/* ───────────────────────── Change mobile number ───────────────────────── */

export async function requestPhoneChangeAction(
  raw: unknown,
): Promise<Result<{ phone: string; resendsLeft: number; devCode?: string }>> {
  const customer = await requireCustomer();
  const parsed = z.object({ phone: Phone }).strict().safeParse(raw);
  if (!parsed.success) return fail("Enter a valid 10-digit mobile number starting with 6–9.");
  const phone = cleanPhone(parsed.data.phone);
  if (phone === customer.phone) return fail("This is already your number.");
  if (await phoneTaken(phone, customer.id)) return fail("This number is linked to another account.");
  const limit = await rateLimit("otp_change_phone", `${customer.id}:${await clientIp()}`, 6, 15);
  if (!limit.ok) return fail(`Too many attempts. Try again in ${limit.retryInMin} min.`);
  const r = await issueAccountOtp(customer.id, "change_phone", phone);
  if (!r.ok) return r;
  return { ok: true, phone, resendsLeft: r.resendsLeft, devCode: r.devCode };
}

export async function verifyPhoneChangeAction(raw: unknown): Promise<Result<{ phone: string }>> {
  const customer = await requireCustomer();
  const parsed = z.object({ phone: Phone, code: Code }).strict().safeParse(raw);
  if (!parsed.success) return fail("Enter the 6-digit OTP.");
  const phone = cleanPhone(parsed.data.phone);
  const limit = await rateLimit("otp_change_verify", String(customer.id), 10, 15);
  if (!limit.ok) return fail(`Too many attempts. Try again in ${limit.retryInMin} min.`);
  if (!(await checkAccountOtp(customer.id, "change_phone", phone, parsed.data.code)))
    return fail("Invalid or expired OTP.");
  if (!(await changePhone(customer.id, phone))) return fail("This number is linked to another account.");
  // TODO(alert): tell the OLD number about the change (WhatsApp/SMS). The WhatsApp outbox has no
  // generic "security alert" template yet, so nothing is queued here.
  return { ok: true, phone };
}

/* ───────────────────────── Communication preferences ───────────────────────── */

export async function setPreferenceAction(raw: unknown): Promise<Result> {
  const customer = await requireCustomer();
  const parsed = z.object({ key: z.enum(PREF_KEYS), value: z.boolean() }).strict().safeParse(raw);
  if (!parsed.success) return fail("Could not save that setting.");
  const limit = await rateLimit("profile_prefs", String(customer.id), 60, 10);
  if (!limit.ok) return fail("Too many changes. Try again in a few minutes.");
  if (parsed.data.key === "email_offers" && parsed.data.value) {
    const profile = await getProfile(customer.id);
    if (!profile?.email) return fail("Add an email first to get offers by email.");
  }
  await setPreference(customer.id, parsed.data.key, parsed.data.value, await clientIp());
  return { ok: true };
}

export async function setLanguageAction(raw: unknown): Promise<Result> {
  const customer = await requireCustomer();
  const parsed = z.object({ language: z.enum(["en", "hi"]) }).strict().safeParse(raw);
  if (!parsed.success) return fail("Could not save the language.");
  await setLanguage(customer.id, parsed.data.language);
  return { ok: true };
}

/* ───────────────────────── Sessions ───────────────────────── */

export async function logoutSessionAction(raw: unknown): Promise<Result<{ wasCurrent: boolean }>> {
  const customer = await requireCustomer();
  const parsed = z.object({ sessionId: z.number().int().positive() }).strict().safeParse(raw);
  if (!parsed.success) return fail("Session not found.");
  const r = await deleteSession(customer.id, parsed.data.sessionId);
  if (!r.found) return fail("This session has already ended.");
  if (r.current) await clearCustomerSession();
  return { ok: true, wasCurrent: r.current };
}

export async function logoutOtherSessionsAction(): Promise<Result<{ count: number }>> {
  const customer = await requireCustomer();
  return { ok: true, count: await deleteOtherSessions(customer.id) };
}

/* ───────────────────────── Privacy & data ───────────────────────── */

/** Direct JSON download (no background job): returns the export as a string for the browser to save. */
export async function downloadMyDataAction(): Promise<Result<{ filename: string; json: string }>> {
  const customer = await requireCustomer();
  const limit = await rateLimit("data_export", String(customer.id), 5, 60);
  if (!limit.ok) return fail(`Please try again in ${limit.retryInMin} min.`);
  const data = await exportCustomerData(customer.id);
  const day = new Date().toISOString().slice(0, 10);
  return {
    ok: true,
    filename: `swadeshi-mahadev-my-data-${day}.json`,
    json: JSON.stringify(data, null, 2),
  };
}

export async function requestDeleteOtpAction(
  raw: unknown,
): Promise<Result<{ resendsLeft: number; devCode?: string }>> {
  const customer = await requireCustomer();
  const parsed = z.object({ confirm: z.literal("DELETE") }).strict().safeParse(raw);
  if (!parsed.success) return fail("Type DELETE to continue.");
  const limit = await rateLimit("otp_delete", `${customer.id}:${await clientIp()}`, 6, 15);
  if (!limit.ok) return fail(`Too many attempts. Try again in ${limit.retryInMin} min.`);
  const r = await issueAccountOtp(customer.id, "delete", customer.phone);
  if (!r.ok) return r;
  return { ok: true, resendsLeft: r.resendsLeft, devCode: r.devCode };
}

export async function confirmDeleteAccountAction(raw: unknown): Promise<Result> {
  const customer = await requireCustomer();
  const parsed = z.object({ confirm: z.literal("DELETE"), code: Code }).strict().safeParse(raw);
  if (!parsed.success) return fail("Enter the 6-digit OTP.");
  const limit = await rateLimit("otp_delete_verify", String(customer.id), 10, 15);
  if (!limit.ok) return fail(`Too many attempts. Try again in ${limit.retryInMin} min.`);
  if (!(await checkAccountOtp(customer.id, "delete", customer.phone, parsed.data.code)))
    return fail("Invalid or expired OTP.");
  await requestDeletion(customer.id);
  await clearCustomerSession();
  return { ok: true };
}

/** Undo a pending deletion while still signed in (shown as a banner). */
export async function cancelDeletionAction(): Promise<Result> {
  const customer = await requireCustomer();
  await cancelDeletion(customer.id);
  return { ok: true };
}
