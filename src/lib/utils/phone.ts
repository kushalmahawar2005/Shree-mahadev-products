/**
 * Any way a shopper types or autofills an Indian mobile ("+91 63678 28788", "091-6367828788",
 * "6367828788") → the 10-digit number. The 91 / 0 prefix is dropped only when there are more than
 * 10 digits, so a real number that starts with 91 (e.g. 9123456789) is kept as is.
 * Inputs using this must allow ~16 characters: a maxLength of 10 cuts "+91 63678 28788" before this runs.
 */
export function toMobile10(raw: string) {
  let d = raw.replace(/\D/g, "");
  if (d.length > 10 && d.startsWith("91")) d = d.slice(2);
  else if (d.length > 10 && d.startsWith("0")) d = d.slice(1);
  return d.slice(0, 10);
}
