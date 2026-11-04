# Security checklist (before launch)

## 1. Rotate every secret that was exposed during setup
These values appeared in chat or terminal logs while building. Generate new ones before going live.

| Secret | Where to rotate | Where it is set in production |
|---|---|---|
| NimbusPost account password | app.nimbuspost.com → Settings → Password & Login | not stored by the app |
| NimbusPost API key + secret | Settings → API Keys → revoke old, create new (role Admin, PII on) | Hostinger env `NIMBUSPOST_API_KEY`, `NIMBUSPOST_API_SECRET` |
| NimbusPost webhook secret | Settings → Webhooks → edit secret | Hostinger env `NIMBUSPOST_WEBHOOK_SECRET` (same value) |
| Hostinger FTP password | hPanel → Files → FTP Accounts | not used by the app |
| Admin password | `pnpm admin:create <user> <new password>` (logs out everywhere) | MySQL `admin_users` (scrypt hash) |
| Admin session secret | any long random string (`openssl rand -hex 32`) | Hostinger env `ADMIN_SESSION_SECRET` (changing it logs everyone out) |
| PayU salt | PayU dashboard → regenerate key/salt if ever shared | Hostinger env `PAYU_KEY`, `PAYU_SALT` |
| Cloudinary API secret | Cloudinary → Settings → API Keys → regenerate | Hostinger env `CLOUDINARY_API_SECRET` |
| Resend API key | resend.com → API Keys | Hostinger env `RESEND_API_KEY` |
| MySQL password | hPanel → Databases | Hostinger env `DATABASE_PASSWORD` |

## 2. What the code already does
- Security headers on every response (`src/lib/security-headers.ts`): CSP (single allow-list), HSTS, nosniff, X-Frame-Options DENY / frame-ancestors none, Referrer-Policy, Permissions-Policy.
- Admin: scrypt-hashed passwords in `admin_users`, HMAC-signed session cookie with a per-user session version, `src/proxy.ts` gate + `requireAdmin()` in every admin action.
- Rate limits stored in MySQL (`rate_limits`): admin login 5/15 min, checkout 10/10 min, notify-me 8/hour per IP.
- zod validation on checkout, cart, shipping quote, contact capture, notify-me, inventory and admin email actions; parameterised SQL everywhere.
- Webhooks verified: PayU reverse hash + amount + verify_payment API; NimbusPost HMAC signature + delivery de-dupe.
- Uploads: signed Cloudinary uploads with format allow-lists; server accepts only our own Cloudinary URLs.

## 3. To add a third-party script later (Meta Pixel, GA4)
Add its hosts to `CSP_SOURCES` in `src/lib/security-headers.ts` (script, connect, img). Nothing else needs changing.
