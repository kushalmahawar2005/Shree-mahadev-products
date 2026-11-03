# Architecture audit — Swadeshi Mahadev storefront

Audit date: 2026-11-04 · Commit audited: `e9bc6a5` · Audit only, no code changed.
Every answer states what exists in code today, with file paths. "NOT BUILT" means no code exists for it.

---

## 1. STACK

| Item | Today |
|---|---|
| Next.js | `16.4.4` (`package.json`), App Router, `cacheComponents: true` (`next.config.ts`) |
| React | `19.3.0` |
| TypeScript | `^5`, strict (`tsconfig.json`) |
| Tailwind | v4 via `@tailwindcss/turbopack`; tokens in `src/app/globals.css` `@theme` |
| Package manager | pnpm `10.33.0` |
| Other runtime deps | `mysql2`, `cloudinary`, `motion`, `lenis`, `@next/mdx`, `clsx`, `tailwind-merge`, `server-only` |
| Rendering | Server Components + Cache Components (PPR). Catalog reads are `"use cache"` with `cacheLife("hours")` and tag invalidation via `updateTag()` from admin actions (`src/lib/commerce/index.ts`, `src/lib/hero.ts`, `src/lib/home-videos.ts`). Product/collection pages prerender with `generateStaticParams`; dynamic parts (cart, checkout, order, admin) stream inside `<Suspense>`. No `export const revalidate` ISR. |
| Shopify code left | Unused provider skeleton: `src/lib/commerce/providers/shopify/{client,index,mutations,normalize,queries}.ts`. It is selectable only with `COMMERCE_PROVIDER=shopify`. Stale Shopify wording in comments/mock text: `src/lib/commerce/types.ts`, `src/data/admin.ts`, `src/data/collections.ts`, `src/components/admin/ui.tsx`, `src/components/home/Sections.tsx`, `src/components/layout/Header.tsx`, `src/app/(admin)/admin/{page,customers/page,discounts/page}.tsx`, `src/app/(site)/(shop)/track-order/page.tsx` |

## 2. DATABASE

- **DB:** MySQL 8 / MariaDB-compatible. Local: Docker container `smp-mysql` on port 3319. Pool: `src/lib/server/db.ts` (`mysql2/promise`, 5 connections, session `time_zone = '+05:30'`).
- **ORM:** none. Raw parameterised SQL in `src/lib/server/*.ts`.
- **Migrations:** `sql/migrations/001_init.sql`, `002_media.sql`, `003_nimbus_v2.sql`, `004_reels.sql`. Runner: `scripts/db-setup.mjs` (`pnpm db:setup`), which records applied files in `schema_migrations`.
- **Tables (key fields):**
  - Catalog: `products` (handle UNIQUE, title, title_hi, category, JSON benefits/best_for/tags/faqs, status active|draft|archived, sort_order), `product_variants` (variant_key UNIQUE, price, compare_at_price, stock_qty NULL=untracked, available, weight_grams, sku UNIQUE), `product_images` (product_handle, public_id, url, sort_order), `collections`, `collection_products`
  - Customers: `customers` (phone UNIQUE), `addresses`
  - Carts: `carts` (token UNIQUE, contact fields, status active|converted, reminder_count, recovered_at, last_activity_at), `cart_items`
  - Orders: `orders` (order_no, token, status, payment_method, address snapshot, subtotal/shipping/cod_fee/discount/total, courier_id/name), `order_items` (price snapshots), `order_events` (status history)
  - Payments/shipping: `payments` (txnid UNIQUE, per attempt), `shipments` (awb UNIQUE, provider order id, label_url, tracking_url, pickup_requested, charged), `shipment_events`
  - Content: `banners` (hero), `reels`, `settings` (key → JSON), `reviews`, `inquiries`, `coupons`
  - Ops: `webhook_logs` (source, ref, delivery_id UNIQUE per source, payload)
- **Seed data:** no SQL seed. The admin button "Import starter catalog" (`src/components/admin/ImportCatalogButton.tsx` → `importStarterCatalogAction` in `src/lib/catalog-actions.ts`) copies `src/data/products.ts` + `src/data/collections.ts` into an empty DB.
- **Where products are read from now:** controlled by `COMMERCE_PROVIDER` (`src/lib/commerce/index.ts`). `db` (local `.env.local`, `.env.example`) reads MySQL via `src/lib/commerce/providers/db.ts` + `src/lib/server/catalog.ts`. If `DATABASE_NAME` is unset (e.g. the Vercel preview), it falls back to the local mock files `src/data/products.ts` via `src/lib/commerce/providers/mock.ts`.

## 3. AUTH

- **Customer login:** NOT BUILT (guest checkout only; customers keyed by phone in `customers`).
- **Admin login:** single shared account from env `ADMIN_USER` / `ADMIN_PASSWORD`. Page: `src/app/(admin)/admin/login/page.tsx`. Action: `src/lib/admin-login-actions.ts`. Password check is a timing-safe compare against plaintext env value, so there is no password hashing.
- **Session:** HMAC-SHA256 signed cookie `smp_admin` (`src/lib/admin-session.ts`, secret `ADMIN_SESSION_SECRET`), payload `{u, exp}`, 7 days, httpOnly, sameSite=lax, secure in production. Not a JWT library.
- **Roles:** NOT BUILT (one admin role).
- **/admin protection:** `src/proxy.ts` redirects every `/admin/*` except `/admin/login` to login unless the cookie verifies. Every admin server action re-checks via `requireAdmin()` (`src/lib/server/admin-auth.ts`).
- **Rate limiting:** admin login only: 5 failed attempts per IP per 15 min, in-memory (`src/lib/admin-login-actions.ts`), reset on server restart. No other rate limits.

## 4. CART & CHECKOUT

- **Cart storage:** cookie `smp_cart` holds the cart contents (base64url `[[variantKey, qty]]`, `src/lib/commerce/providers/{db,mock}.ts`). A second cookie `smp_cid` points to a server copy in `carts` / `cart_items`, used for abandoned-cart tracking (`src/lib/server/cart-cookies.ts`, `src/lib/server/carts.ts`). The cart is a drawer (`src/components/cart/CartDrawer.tsx`). Mutations are server actions (`src/lib/commerce/actions.ts`). Stock caps the quantity (db provider).
- **Checkout pages:** `/checkout` (`src/app/(site)/(shop)/checkout/page.tsx` + `src/components/checkout/CheckoutForm.tsx`), `/checkout/pay?t=` (PayU redirect), `/order?t=` (confirmation/status).
- **Address form:** name, mobile (10-digit, starts 6–9), email, line1/line2, city, state (fixed list), pincode (6-digit). Validated server-side in `src/lib/checkout-actions.ts`. Contact fields are saved to the cart on blur for abandoned-cart follow-up.
- **Pincode check:** yes. `quoteShippingAction` → NimbusPost v2 serviceability (`src/lib/server/shipping.ts`, `src/lib/server/nimbuspost.ts`). Unserviceable pincodes block the order. Without NimbusPost keys it falls back to the flat fee in `src/data/site.ts`.
- **COD:** yes, toggled by `site.codAvailable`. The COD charge comes from the cheapest COD courier quote. COD is hidden when no courier serves COD for that pincode.
- **Order creation flow:**
  1. The server re-prices the cart from the catalog. Browser prices are never used. Unavailable or ₹0 items are rejected.
  2. Shipping is re-quoted server-side for the chosen method. A blocked pincode returns an error.
  3. `createOrder` runs in one transaction (`src/lib/server/orders.ts`): upsert customer by phone → insert address → insert order (`cod_pending` or `pending_payment`) → `order_no = SMP{1000+id}` → order_items → order_event → link cart (COD marks the cart converted immediately).
  4. COD: clear cart cookies → `/order?t=…`.
  5. PayU: `/checkout/pay?t=…` → `startPaymentAttempt` (new `payments` row and txnid) → auto-submit to PayU → `/api/payu/callback` → `/order?t=…`.
  - **Stock is NOT decremented on order: NOT BUILT.**

## 5. PAYMENTS

- **Gateway:** PayU India hosted checkout (`src/lib/server/payu.ts`). Not Razorpay, PhonePe or Cashfree. `PAYU_MODE=test|live` selects `test.payu.in` or `secure.payu.in`.
- **Verification:** request hash `sha512(key|txnid|amount|productinfo|firstname|email|udf1..|salt)`. The callback (`src/app/api/payu/callback/route.ts`) checks the reverse hash (timing-safe), `udf1 == order token`, and that the amount equals the payment row. It then confirms server-to-server with PayU `verify_payment`. Only then does it run `markPaid`. Idempotent on repeat posts. Raw callback stored in `webhook_logs` (hash removed).
- **Webhook route:** only surl/furl (`/api/payu/callback`). PayU server-to-server webhook: NOT BUILT. No reconciliation job for payments left `pending`: NOT BUILT.
- **Refund flow:** NOT BUILT (`refunded` status exists, no API call).
- **Status:** PayU never tested end to end (no PayU keys yet).

## 6. ORDERS & SHIPPING

- **Order statuses** (`src/lib/server/orders.ts`): `pending_payment`, `payment_failed`, `paid`, `cod_pending`, `confirmed`, `packed`, `shipped`, `delivered`, `cancelled`, `rto`, `refunded`. Every change is logged to `order_events`.
- **NimbusPost Partner API v2** (`src/lib/server/nimbuspost.ts`, auth headers `x-api-key` + `x-api-secret`; connection verified live: warehouse found, wallet ₹1,600, 26 couriers quoted):
  - Rates at checkout (cheapest courier) and in admin (all couriers).
  - Booking from admin: `POST /v2/shipments`, auto pickup, AWB + label + tracking URL saved (`src/lib/server/shipments.ts`, `src/components/admin/ShipmentPanel.tsx`). Never exercised against the live account, because it charges the wallet.
  - Fresh label link (`/v2/shipments/labels`), request pickup, cancel (`/v2/shipments/cancel`), refresh tracking (`/v2/tracking/{awb}`).
  - Tracking webhook: `src/app/api/nimbuspost/webhook/route.ts`. It verifies `x-nimbus-signature` HMAC with `NIMBUSPOST_WEBHOOK_SECRET`, de-dupes `x-nimbus-delivery`, logs the payload and maps courier status to shipment and order status. Not yet registered in NimbusPost (needs the live URL).
  - Manifest (`/v2/manifests`): NOT BUILT. NDR handling: NOT BUILT.
- **Invoices (GST):** NOT BUILT (GST number is still `TODO(client)` in `src/data/site.ts`).
- **Order emails / WhatsApp to customer:** NOT BUILT. The admin can open WhatsApp manually, and the abandoned-cart reminder is a manual `wa.me` link.

## 7. ADMIN

| Page | Data | What really saves |
|---|---|---|
| `/admin/login` | real | sets session cookie |
| `/admin` (dashboard) | **mock** (`src/data/admin.ts`) + catalog | nothing |
| `/admin/orders` | **real DB**: filters, search, pagination | — |
| `/admin/orders/view?id=` | **real DB** | courier rates, book/cancel shipment, label, pickup, refresh tracking, mark COD confirmed / delivered / cancelled |
| `/admin/products` | **real DB** | bulk active/draft/archive, add/remove collection, delete, import starter catalog |
| `/admin/products/edit[?handle=]` | **real DB** | create/update product, sizes, stock, weight, SKU, FAQs, collections, SEO; photos upload/reorder/alt/delete |
| `/admin/abandoned-carts` | **real DB** | "WhatsApp" marks reminder sent |
| `/admin/banners` | **real DB** | hero slides upload/replace/mobile image/link/alt/live/reorder/delete |
| `/admin/videos` | **real DB** | reels upload/caption/product link/Instagram link/live/reorder/delete; brand-film YouTube link |
| `/admin/categories`, `/admin/categories/[handle]` | catalog read, **UI only** (`MockSave`) | nothing |
| `/admin/customers` | **mock** | nothing |
| `/admin/discounts` | **mock** (`coupons` table exists, unused) | nothing |
| `/admin/reviews` | **mock** (`reviews` table exists, unused) | nothing |
| `/admin/inquiries` | **mock** (`inquiries` table exists, unused) | nothing |
| `/admin/settings` | **UI only** (`MockSave`); shipping/COD values live in `src/data/site.ts` | nothing |

## 8. MEDIA

- **Cloudinary only** (`src/lib/server/cloudinary.ts`). The browser uploads directly to Cloudinary with a server-signed request (`signUploadAction` in `src/lib/media-actions.ts`; client `src/components/admin/media/upload.ts`). Folders: `swadeshi-mahadev/{products,banners,reels,static}`.
- Delivery: custom `next/image` loader adds `f_auto,q_auto:good,c_limit,w_N` (`src/lib/image-loader.ts`); videos use `f_auto:video,q_auto,w_N` with a poster frame. Measured: 226 KB PNG → 36 KB; 9 MB video → 0.48 MB.
- Static decor images were moved to Cloudinary. Only SVG placeholders, `logo.png` and `public/images/products/groundnut-oil-2l.png` remain in `public/`.
- Deleting a photo, banner or reel also deletes the Cloudinary asset.

## 9. EMAIL / WHATSAPP / SMS

NOT BUILT. No provider is installed (no Resend, Nodemailer, MSG91, Twilio or WhatsApp Business API). The only messaging is `wa.me` deep links: the bulk inquiry form (`src/components/BulkForm.tsx`), "Order on WhatsApp" fallbacks, and admin abandoned-cart reminders.

## 10. TRACKING & ADS

NOT BUILT: Meta Pixel, Conversions API, GA4, Google Ads, product feed (Merchant Center), cookie consent, UTM capture on orders. Nothing fires on purchase. `src/components/analytics/` does not exist.

## 11. SEO

- Metadata: root template + OG in `src/app/(site)/layout.tsx`; per-page `pageMetadata()` (`src/lib/utils/seo.ts`); `noindex` on checkout, order and admin.
- JSON-LD: Organization + LocalBusiness (`src/app/(site)/layout.tsx`), Product (`products/[handle]/page.tsx`), BreadcrumbList (product + collection pages), FAQ (`faq/page.tsx`).
- `robots.ts`: yes. It disallows everything unless `NEXT_PUBLIC_SITE_URL` is the live domain.
- **sitemap.ts: NOT BUILT** (robots.ts points to `/sitemap.xml`, which does not exist).
- `not-found.tsx`: NOT BUILT (default Next 404).
- WooCommerce 301s: `src/data/redirects.ts` via `next.config.ts` covers `/product/*`, `/product-category/*`, `/cart`, `/my-account`, `/contact-us`, `/about-us`, `/privacy-policy`, `/refund_returns`. **`/privacy-policy` and `/refund_returns` point to `/policies/*`, and those pages are NOT BUILT** (MDX exists in `src/content/policies`, but there is no route). Recipes and journal pages are also NOT BUILT (MDX content exists).

## 12. SECURITY

- **Secrets:** server-only env vars read in `server-only` modules. `.env*` is gitignored except `.env.example`. Only the Cloudinary cloud name, site URL and WhatsApp number are `NEXT_PUBLIC_`. **Risk:** NimbusPost password/secret, webhook secret and FTP password were exposed in chat and terminal logs during setup and should be rotated before launch.
- **Input validation:** hand-written, no zod: checkout (`src/lib/checkout-actions.ts`), product save (`src/lib/catalog-actions.ts`), media actions (`src/lib/media-actions.ts`), shipping actions (`src/lib/admin-actions.ts`). SQL is always parameterised.
- **CSRF:** relies on Next server-action origin checks and the sameSite=lax cookie. Route handlers are authenticated by signature (PayU hash, NimbusPost HMAC).
- **Security headers (CSP, HSTS, X-Frame-Options, etc.): NOT BUILT** (none in `next.config.ts`). The images config has a CSP only for SVGs.
- **Uploads:** signed Cloudinary uploads restricted by `allowed_formats` (images: jpg/png/webp/avif/heic; video: mp4/mov/webm/m4v). Size limits are enforced client-side (10 MB image, 100 MB video, Cloudinary free-plan caps). The server accepts only URLs from our cloud and folder (`isOwnCloudinaryUrl`).
- **Admin API:** every admin server action calls `requireAdmin()`. `/admin` pages are gated by `src/proxy.ts`.

## 13. HOSTING READINESS (Hostinger)

- **Needs a Node.js server: YES.** Reasons: SSR/streaming pages, server actions (cart, checkout, admin), route handlers (`/api/payu/callback`, `/api/nimbuspost/webhook`, `/cart/recover/[token]`), `proxy.ts`, a MySQL connection pool, and Cache Components. A static export is not possible.
- **Build output:** default `.next` (no `output: "standalone"`). Run with `pnpm build && pnpm start`. Node ≥ 20.9 is required by Next 16; local dev uses Node 26.
- **Env vars:** `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_WHATSAPP_NUMBER`, `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`, `COMMERCE_PROVIDER=db`, `DATABASE_HOST/PORT/NAME/USER/PASSWORD`, `PAYU_MODE/KEY/SALT`, `NIMBUSPOST_API_KEY/API_SECRET/PICKUP_PINCODE/WAREHOUSE_NAME` (optional `NIMBUSPOST_WAREHOUSE_ID`), `NIMBUSPOST_WEBHOOK_SECRET`, `CLOUDINARY_API_KEY/API_SECRET`, `ADMIN_USER/ADMIN_PASSWORD/ADMIN_SESSION_SECRET`. The old `SHOPIFY_*` vars are unused.
- **DB connection:** `DATABASE_HOST=127.0.0.1` on the same Hostinger server. Run `node scripts/db-setup.mjs` once, then "Import starter catalog" in admin. Create a new DB; do not reuse the WordPress DB `u458241914_OkvaB`.
- **Storage that breaks on restart:** none for files (all media on Cloudinary). In-memory only, lost on restart (harmless): admin login throttle, NimbusPost warehouse id cache, shipping quote cache, Next's local cache handler (refills automatically).
- **Cron jobs:** none required by current code. Recommended later: reconcile `pending` PayU payments, and auto-refresh tracking if webhooks fail.
- **Webhooks needing a public HTTPS URL:** PayU surl/furl (`NEXT_PUBLIC_SITE_URL/api/payu/callback`), NimbusPost `…/api/nimbuspost/webhook`.
- **Recommendation: Hostinger Node.js Web App on the Business plan.** It runs `next start` with MySQL on the same host and needs no server administration. Shared/static hosting cannot run this app. Move to a VPS only if `next build` runs out of memory on the shared Node environment, or when background workers/cron or more control are needed.

## 14. GAPS (to go live)

**P0 — must have before launch**
1. Hostinger hPanel access → back up the old WordPress site → new MySQL DB → deploy Node app → env vars → `db-setup` → import catalog → domain switch.
2. PayU test keys → full end-to-end test (success, failure, retry); then live keys and PayU domain approval.
3. Real catalog data: final prices for TBD sizes (local DB currently has **test prices**), packed weights, stock, photos for every product.
4. Policy pages (`/policies/privacy|refund-return|shipping|terms`). MDX exists but there are no routes, and the existing 301s point to them.
5. `sitemap.ts` and a branded `not-found.tsx`.
6. Order confirmation to the customer (email or WhatsApp) and a new-order alert to the store.
7. Stock decrement on paid/COD order (and restock on cancel).
8. One real NimbusPost booking → label → pickup → webhook test; register the webhook on the live URL.
9. Rotate the secrets exposed during setup (NimbusPost password/API secret, webhook secret, FTP password); set strong `ADMIN_PASSWORD` + `ADMIN_SESSION_SECRET` in production.
10. Security headers (HSTS, X-Frame-Options/frame-ancestors, Referrer-Policy, basic CSP).

**P1 — soon after launch**
- GST invoice PDF; GST number on site.
- GA4 + Meta Pixel (+ Conversions API) with a purchase event; UTM capture on orders; cookie consent.
- PayU server-to-server webhook + reconciliation for `pending` payments; refund action.
- Real admin data for dashboard, customers, inquiries (bulk form → `inquiries` table), reviews (Judge.me or own `reviews`), discounts/coupons at checkout, settings (shipping/COD from `settings` table instead of `src/data/site.ts`).
- Remove the unused Shopify provider and stale Shopify comments.
- Track-order page tied to `/order?t=` / AWB instead of the WhatsApp-only flow.

**P2 — later**
- Customer accounts / order history; multiple admin users with roles and hashed passwords.
- Recipes and journal pages (MDX ready); Google Merchant product feed.
- NDR handling and v2 manifest in admin; automated abandoned-cart reminders.
- zod schemas for validation; persistent rate limiting.
