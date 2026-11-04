/**
 * Admin session token: "<base64url payload>.<base64url HMAC-SHA256>".
 * Uses Web Crypto so it runs in both proxy.ts and server actions.
 */
export const ADMIN_COOKIE = "smp_admin";
export const SESSION_DAYS = 7;

const enc = new TextEncoder();
const b64url = (buf: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

function secret() {
  // A dedicated secret is best; falling back to the password still rotates sessions when it changes.
  const s = process.env.ADMIN_SESSION_SECRET;
  if (!s) throw new Error("ADMIN_SESSION_SECRET is not set");
  return s;
}

async function key() {
  return crypto.subtle.importKey("raw", enc.encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

/** `v` = admin_users.session_version; bumping it (password change) logs that admin out everywhere. */
export async function createSessionToken(user: string, v = 1): Promise<string> {
  const payload = b64url(enc.encode(JSON.stringify({ u: user, v, exp: Date.now() + SESSION_DAYS * 86_400_000 })));
  const sig = await crypto.subtle.sign("HMAC", await key(), enc.encode(payload));
  return `${payload}.${b64url(sig)}`;
}

/** Signature + expiry only (runs in proxy). requireAdmin() also checks the user and session version in MySQL. */
export async function verifySessionToken(token: string | undefined): Promise<{ u: string; v: number } | null> {
  if (!token || !token.includes(".")) return null;
  const [payload, sig] = token.split(".");
  try {
    const ok = await crypto.subtle.verify("HMAC", await key(), fromB64url(sig), enc.encode(payload));
    if (!ok) return null;
    const data = JSON.parse(new TextDecoder().decode(fromB64url(payload))) as { u: string; v?: number; exp: number };
    if (typeof data.exp !== "number" || data.exp < Date.now() || typeof data.u !== "string") return null;
    return { u: data.u, v: data.v ?? 1 };
  } catch {
    return null;
  }
}
