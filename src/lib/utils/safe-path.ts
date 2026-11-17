/**
 * A same-site path to redirect to after login, or `fallback`. Rejects protocol-relative and
 * backslash tricks ("//evil.com", "/\evil.com", "/%5Cevil.com"), control characters and anything
 * that resolves to another origin.
 */
export function safeInternalPath(v: unknown, fallback = "/account"): string {
  if (typeof v !== "string" || !v.startsWith("/") || v.length > 512) return fallback;
  let decoded = v;
  try {
    decoded = decodeURIComponent(v);
  } catch {
    return fallback;
  }
  if (/[\\\u0000-\u001f\u007f]/.test(decoded) || decoded.startsWith("//")) return fallback;
  try {
    const base = "https://internal.invalid";
    const u = new URL(v, base);
    if (u.origin !== base) return fallback;
    return `${u.pathname}${u.search}${u.hash}`;
  } catch {
    return fallback;
  }
}
