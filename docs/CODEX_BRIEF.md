# Codex brief: Swadeshi Mahadev storefront (continue from Prompt 9)

You are continuing a working Next.js 16 store. **Read this whole file first**, then `../AGENTS.md` (business + design rules, Hinglish), `docs/ARCHITECTURE_AUDIT.md` (older snapshot, still useful), `docs/SECURITY_CHECKLIST.md`, `docs/PAYU_TEST_PLAN.md`. The user's original task list is `/Users/kushalmahawar/Documents/ADMIN_PROMPTS.md` (prompts 0–22). Prompts **0–5, 7, 8 are done**. **Prompt 6 (deploy to Hostinger) is ON HOLD — do not do it.** Do the remaining prompts **one at a time, in this order: 9, 10, 11, 12, 13, 14, 16, 15, 20, 21, 17, 19, 18, 22**. After each: typecheck, lint, build, run tests, commit, then stop and report.

---

## 1. Stack and where things live

- **Next.js 16.4** App Router, React 19, TypeScript strict, Tailwind v4 (tokens in `src/app/globals.css`), pnpm. `cacheComponents: true`, `partialPrefetching: true`, `experimental.globalNotFound: true`.
- **MySQL 8** via `mysql2`, **raw parameterised SQL**, no ORM. Pool: `src/lib/server/db.ts` (session time zone IST). Migrations: `sql/migrations/NNN_name.sql` (latest is `008_refunds.sql`), run with `pnpm db:setup` (tracks `schema_migrations`). **Never edit an applied migration; add a new numbered file.**
- **Local DB**: Docker container `smp-mysql` on **port 3319** (`docker start smp-mysql`). Creds are in `.env.local` (never commit it; it holds real secrets).
- **Dev server**: the user runs `pnpm dev` on `localhost:3000`. Don't start a second one.
- **Commerce**: `COMMERCE_PROVIDER=db` → `src/lib/commerce/providers/db.ts` + `src/lib/server/catalog.ts`. Mock provider (`src/data/*.ts`) is only a no-DB fallback (Vercel preview). UI uses `src/lib/commerce/index.ts` only.
- **Cart**: cookie `smp_cart` (contents) + `smp_cid` (DB copy in `carts` for abandoned-cart recovery). Server actions in `src/lib/commerce/actions.ts`.
- **Checkout**: `src/lib/checkout-actions.ts` (zod, rate-limited) → `createOrder` (`src/lib/server/orders.ts`) → COD `/order?t=` or PayU `/checkout/pay?t=`.
- **Payments**: PayU (`src/lib/server/payu.ts`, `payu-process.ts`), routes `/api/payu/callback`, `/api/payu/webhook`, `/api/cron/payu-reconcile`. Refunds `src/lib/server/refunds.ts`.
- **Shipping**: NimbusPost Partner API v2 (`src/lib/server/nimbuspost.ts`, auth headers `x-api-key` + `x-api-secret`), shipments `src/lib/server/shipments.ts`, webhook `/api/nimbuspost/webhook` (HMAC `x-nimbus-signature`). **Never book a real shipment in tests** (it charges the wallet).
- **Inventory**: `src/lib/server/inventory.ts` (locked stock take, PayU holds, restock). Admin `/admin/inventory`.
- **Email**: Resend through `email_outbox` (`src/lib/server/mail.ts`, template `src/emails/OrderEmail.tsx`). Use `notifyOrder(orderId, kind)` **after** a DB change commits. No `RESEND_API_KEY` yet, so mails wait in the outbox (expected).
- **Media**: Cloudinary only. Signed browser uploads (`signUploadAction` in `src/lib/media-actions.ts`, `src/components/admin/media/DropZone.tsx`), custom `next/image` loader `src/lib/image-loader.ts`. Allowed folders: products, banners, reels (add new ones in `src/lib/server/cloudinary.ts` + `media-actions.ts`).
- **Store settings**: `getStoreSettings()` (`src/lib/server/store-settings.ts`, cached, tag `settings`), schema in `src/lib/store-settings.ts`, client hook `useStoreSettings()` from `src/components/StoreSettingsProvider.tsx`. `src/data/site.ts` is fallback only.
- **Admin auth**: `/admin/login`, table `admin_users` (scrypt), signed cookie `smp_admin` with `{u, v, exp}` (`src/lib/admin-session.ts`), gate `src/proxy.ts`, and **every admin server action must call `requireAdmin()`** (`src/lib/server/admin-auth.ts`, returns `{username, role, id}`). Local login: `admin` / `admin12345`. Create/reset admins: `pnpm admin:create <user> <pass> [role]`.
- **Security**: headers + CSP in `src/lib/security-headers.ts` (single allow-list; add new third-party hosts there). Rate limiter: `rateLimit(name, key, max, windowMin)` in `src/lib/server/rate-limit.ts` (MySQL `rate_limits`).
- **Admin UI kit**: `src/components/admin/ui.tsx` (`PageHeader`, `Card`, `StatCard`, `StatusBadge` tones green|amber|red|gray, `Table`, `Field`, `inputCls`). Sidebar items: `src/components/admin/AdminShell.tsx`. Order status labels: `src/components/admin/orderLabels.ts`.

## 2. Tables that exist (use them, don't recreate)
`products, product_variants (variant_key, price, compare_at_price, stock_qty NULL=untracked, available, weight_grams, sku), product_images (by product_handle), collections, collection_products, customers (phone UNIQUE), addresses, carts, cart_items, orders, order_items, order_events, payments, refunds, shipments, shipment_events, stock_reservations, inventory_log, back_in_stock, email_outbox, banners, reels, settings (key→JSON), reviews (product_handle, order_id, name, city, rating, title, body, status pending|approved|rejected), inquiries (kind, name, business, city, phone, email, product, quantity, message, status), coupons (code, kind percent|flat, value, min_subtotal, max_discount, first_order_only, usage_limit, used_count, starts_at, ends_at, active), webhook_logs, admin_users, rate_limits, schema_migrations`.

Money is **whole rupees, INT UNSIGNED** everywhere. Keep it that way.

## 3. Rules for every change
1. New table/column → new migration file, then `pnpm db:setup`.
2. Every admin server action: `await requireAdmin()` first; validate input with **zod** (`.strict()` objects; reject unknown fields).
3. Every order status change goes through `setOrderStatus()` (writes `order_events`, handles restock/emails). Don't `UPDATE orders SET status` directly.
4. SQL is parameterised; lists use one `IN (?)` query, never N+1.
5. After changing storefront data, call `updateTag(...)` (`TAGS` in `src/lib/commerce/index.ts`, `"settings"`, `"banners"`, `"videos"`).
6. Copy rules (`../AGENTS.md` §13): no fake claims, no invented numbers, no fake reviews/ratings. Unknown facts → `TODO(client)`.
7. UI: mobile-first, works at 390px; 44px touch targets; real `<button>`/`<a>`; no ALL CAPS labels; brand tokens (forest, mustard, khaki-soft, ink, ink-muted, line, sale).
8. Commit after each prompt with a clear message ending with:
   `Co-Authored-By: <your attribution line>`. The project has its **own** git repo in this folder (branch `main`). The parent home folder is a different repo — never commit there.

## 4. Next 16 gotchas we already hit (avoid them)
- **Dynamic route params outside `<Suspense>`** trigger "encountered URL data" in dev. For pages that must 404 properly (unknown handle/slug), add `export const instant = false;` (see `src/app/(site)/(shop)/products/[handle]/page.tsx`). Don't wrap in Suspense there (that turns 404 into a streamed 200).
- **Admin/dynamic pages**: put the data part in an async component inside `<Suspense>` and call `await connection()` first (see `src/app/(admin)/admin/inventory/page.tsx`).
- **`Date.now()` / `new Date()` during prerender is an error.** Do date math inside a `"use cache"` function (see `getLiveAnnouncements` in `store-settings.ts`) or after `await connection()`.
- **A client component must not import a module that contains `"use cache"`** (e.g. `src/lib/server/*`). Render server pieces in a server component and pass them as props/slots (see `AnnouncementBar` passed into `Header` from `SiteChrome.tsx`).
- **`dynamicParams` is not allowed** with cacheComponents.
- **Server actions are callable from any route**; the POST must target a route that renders a component importing that action when testing via HTTP (find action ids in `.next/dev/**/server-reference-manifest.json`).
- **mysql2 returns JSON columns already parsed** (MySQL); MariaDB returns text. Use the tolerant parse pattern in `getSetting()` (`src/lib/server/videos.ts`).
- **Unlayered global CSS beats Tailwind utilities.** Put global rules in `@layer base`.
- Large decorative images: use `DecoBg` (CSS background, `src/components/ui/DecoBg.tsx`) not `next/image`, to avoid LCP warnings.
- After editing `next.config.ts` or `.env.local`, the dev server reloads; give it ~10 s.
- The user's shell is **zsh**: unquoted `$VAR` doesn't word-split (use `${=VAR}`), and `--include=*.ts` globs fail unquoted.

## 5. How to test (patterns already in the repo)
- `npx tsc --noEmit`, `pnpm -s lint`, `pnpm build` must all be clean.
- HTTP tests against the dev server with real server actions: see `scripts/test-inventory.mjs`, `test-emails.mjs`, `test-payu.mjs`, `test-settings.mjs` (they read action ids from the dev manifest, sign an admin cookie with `ADMIN_SESSION_SECRET` + `{u:"admin", v:1}`, and clean up their rows). Add `scripts/test-<feature>.mjs` + a `pnpm test:<feature>` script for each prompt. **Always clean up test data and restore settings you change.**
- Visual check: headless Chrome via CDP at true 390px and 1440px (`Emulation.setDeviceMetricsOverride`); macOS headless `--window-size` can't go below ~500px.
- Console must be clean (no React/Next errors) on pages you touch.

## 6. Open items outside the prompts (do NOT fake these)
- **PayU test/live key + salt** missing → real payment/refund paths untested (`docs/PAYU_TEST_PLAN.md`).
- **Resend API key** missing → emails wait in outbox. Test sender `onboarding@resend.dev` only reaches the Resend account owner.
- **Local DB has TEST prices** for TBD sizes (from development). Production catalog must use client's real prices (import from `src/data/products.ts`, then edit in admin).
- Only Groundnut has a real photo. Client to upload the rest in admin.
- Secrets to rotate before launch: `docs/SECURITY_CHECKLIST.md`.

---

## 7. Remaining prompts — exact scope

### Prompt 9 · Customers (real)
- Pages: `/admin/customers` (list) and `/admin/customers/view?id=` (use `?id=` query pages like orders, not `[id]`).
- List from `customers` + aggregates (orders count, lifetime value from PLACED statuses — reuse `PLACED` from `src/lib/server/dashboard.ts`, last order date, COD-only flag, RTO count). Search name/phone/email; filters: repeat (≥2 orders), one-time, high value (LTV ≥ ₹5,000, make it a constant), inactive 90 days, COD-only, RTO history (badge "Risky" if ≥1 RTO). Pagination 25/page, two queries per page.
- Detail: profile, addresses, orders table (link to order view), lifetime value, notes + tags (migration: `customers.notes TEXT NULL`, `customers.tags JSON NULL`), WhatsApp + call buttons, "Mask phone" off by default for owner.
- CSV export (all filtered rows; columns name, phone, email, city, state, orders, LTV, last order) as a route handler `/admin/customers/export` guarded by `requireAdmin()`; log each export to a new `activity_log` table (create it now with columns id, admin_username, action, target, meta JSON, created_at — Prompt 17 will reuse it).
- Remove `customers` mock from `src/data/admin.ts` when done.
- Test: `pnpm test:customers` seeds 3 customers/orders, checks filters + export CSV header, cleans up.

### Prompt 10 · Bulk inquiries (real)
- `/bulk-orders` form (`src/components/BulkForm.tsx`) → server action: zod (+ honeypot field), `rateLimit("inquiry", ip, 5, 60)`, insert into `inquiries` (kind `bulk`), queue a store alert email (add template kind `store_new_inquiry` to `OrderEmail.tsx` or a small separate template; `email_outbox.order_id` is nullable), then still open the WhatsApp deep link (existing behaviour).
- Migration: `inquiries` add `assignee VARCHAR(60) NULL, follow_up_at DATE NULL, quote_amount INT UNSIGNED NULL, updated_at`, and table `inquiry_notes (id, inquiry_id FK, author, body, created_at)`.
- Admin `/admin/inquiries`: table view + Kanban view (columns New → Contacted → Quote sent → Won → Lost; status values `new|contacted|quoted|won|lost`), drag between columns (HTML5 DnD + buttons for mobile), assignee, follow-up date, notes timeline, WhatsApp/Call buttons.
- Dashboard "Needs attention": add "Inquiry follow-ups due today" (follow_up_at ≤ today, status not won/lost).
- "Create manual order" for won leads: admin form creating an order with custom unit prices (source `admin`, payment method `cod` or mark paid offline) using `createOrder` — extend it with an optional `source` and price override **only for admin path**; stock still taken via `takeStock`.
- Remove inquiries mock. Test `pnpm test:inquiries`.

### Prompt 11 · Coupons (end to end)
- Admin `/admin/discounts` → rename UI to "Coupons": list + create/edit: kinds `percent | flat | free_shipping` (add `free_shipping` to the `kind` values; migration if needed), value, min order, max discount, first-order-only (by phone), usage limit total + per phone (migration: `coupons.per_phone_limit INT NULL`, table `coupon_redemptions (coupon_id, order_id, phone, amount, created_at)`), applies to all / selected products / selected collections (migration: `coupon_targets (coupon_id, kind 'product'|'collection', handle)`), start/end dates, active toggle, usage + revenue stats. Warn (not block) above 25% off. Code is uppercase, unique.
- Checkout: "Apply coupon" field in `CheckoutForm.tsx`, server action validates and **re-prices server-side** (never trust browser). Discount stored on the order (`orders.discount`, `orders.coupon_code` already exist), shown in summary, email and admin. Usage counted only when the order is placed (COD) or paid (PayU) — record in `coupon_redemptions` inside the same transaction; release if payment fails/expires. Clear errors ("This code needs a ₹999 minimum order").
- Rate-limit coupon attempts (`rateLimit("coupon", ip, 15, 10)`).
- PayU amount = total after discount. Free-shipping coupon sets shipping to 0.
- Remove discounts mock. Test `pnpm test:coupons` (min order, first-order-only, per-phone limit, expired, percent cap, totals in DB).

### Prompt 12 · Reviews (own system, real only)
- Migration: `reviews` add `reply TEXT NULL, featured TINYINT(1) DEFAULT 0, source VARCHAR(12) DEFAULT 'site'` and table `review_photos (review_id, url, public_id)`.
- Signed review link per delivered order: `/review?t=<orderToken>` (order must be `delivered`; one review per product per order). Add the link to the "delivered" email.
- Form: stars (1–5, accessible radio group), title, text, optional photos (Cloudinary folder `reviews`, max 3, images only). zod + rate limit. Status `pending`.
- Auto-hold (keep pending + flag) if text contains links or repeats the same keyword unusually often (AGENTS.md: no keyword-stuffed reviews).
- Admin `/admin/reviews`: tabs Pending / Published / Hidden, approve/hide, public reply, feature on homepage (max 6), manual import with `source='google'` (name, rating, text, date).
- Storefront: rating + count on cards and PDP from **approved** reviews (already aggregated in `loadProducts`; extend if needed), review list on PDP with photos, homepage reviews section with featured ones (replace the TODO in `src/components/home/Sections.tsx` or add to `PicksSections.tsx`), `AggregateRating` in Product JSON-LD **only when reviews exist**.
- Remove reviews mock. Test `pnpm test:reviews`.

### Prompt 13 · Collections (real save)
- `/admin/categories` → rename to "Collections" in sidebar and UI. Make it real: create/edit (title, handle with automatic 301 on handle change — store old→new in a new `redirects` table and serve them from `src/proxy.ts` or a catch-all; keep it simple and fast), description, image (Cloudinary), SEO title/description (migration columns), in-menu toggle, menu order (drag), homepage toggle; add/remove/reorder products; delete with confirm (not the four core handles used by nav: wood-pressed-oils, raw-honey, natural-sweeteners, bestsellers).
- `updateTag(TAGS.collections)` + the collection tag on save. Header mega menu and footer should read collections flagged in-menu (currently hard-coded in `src/data/site.ts` nav).
- Test `pnpm test:collections`.

### Prompt 14 · GST invoice
- Migration: `products.hsn VARCHAR(10) NULL, products.gst_rate DECIMAL(4,2) NULL` (editable in the product form), table `invoices (id, order_id UNIQUE, invoice_no UNIQUE, fy VARCHAR(9), seq INT, created_at)`.
- Invoice number per financial year `SMP/2026-27/0001` generated in a transaction (lock the FY row).
- PDF with `@react-pdf/renderer` (server-side route `/admin/orders/invoice?id=` guarded by `requireAdmin()`, and a customer link via order token `/order/invoice?t=`): seller legal name, address, GSTIN, FSSAI (from store settings); buyer; HSN + rate per line; **CGST+SGST if buyer state is Rajasthan, else IGST**; prices treated as GST-inclusive unless settings say otherwise (add a settings flag `pricesIncludeGst`, default true, `TODO(client)` to confirm); totals; amount in words.
- Generate on paid/COD-placed; download in admin order page; link in delivered email; bulk print (select orders → one merged PDF).
- If GSTIN is empty in settings, show "Bill of supply" wording and no tax split (don't invent a GSTIN).
- Test: numbering sequence + state split.

### Prompt 16 · Track order page
- `/track-order`: enter order no. + phone (or arrive from email link with token) → status timeline from `order_events` + `shipment_events`, courier, AWB, tracking link, expected delivery, "Need help? WhatsApp us" with order no. prefilled. `rateLimit("track", ip, 20, 10)`. No login. Show only the masked address.

### Prompt 15 · Meta Ads + Google tracking (big; follow `ADMIN_PROMPTS.md` Prompt 15 exactly)
Key points: consent banner + Google Consent Mode v2 (marketing tags only after consent); first-party UTM/click-id cookie (90 days) copied onto cart and order (migration: orders/carts columns utm_source, utm_medium, utm_campaign, utm_content, utm_term, fbclid/_fbc, gclid, landing_page, referrer, client_ip, user_agent); Meta Pixel (browser) + Conversions API (server, `src/lib/server/meta-capi.ts`) with **shared event_id** for dedup; Purchase sent server-side from `markPaid` and COD order creation (event_id = order_no, hashed SHA-256 user data), browser Purchase once on `/order` with the same id; custom `CODConfirmed`; GA4 ecommerce + Measurement Protocol purchase with same transaction_id; Google Ads conversion; feeds `/feeds/meta.xml` and `/feeds/google.xml` (one item per variant, id = SKU, item_group_id = handle, price = MRP, sale_price, availability from stock, Cloudinary image), PDP preselects `?size=`; Microsoft Clarity behind consent; add every host to `CSP_SOURCES`; admin `/admin/marketing` with status cards, test-event buttons, feed URLs + counts, last 50 server events, UTM link builder, orders-by-source report. Use the outbox pattern (or a sibling `events_outbox`) with retries; never block checkout. Env: `META_PIXEL_ID, META_CAPI_TOKEN, META_TEST_EVENT_CODE, GA4_MEASUREMENT_ID, GA4_API_SECRET, GOOGLE_ADS_ID, GOOGLE_ADS_LABEL, CLARITY_ID` (all optional; features off when missing).

### Prompt 20 · Shipping ops (NDR + manifest)
- NimbusPost v2 has `POST /v2/manifests`, `GET /v2/ndr`, `POST /v2/ndr/{awb}/action` (spec embedded at `https://api-v2.nimbuspost.com/docs/reference/v2`). Admin: daily manifest PDF for booked shipments; NDR list with actions re-attempt / change address-phone / RTO; WhatsApp customer from the row. Tracking auto-refresh route `/api/cron/tracking-refresh` (x-cron-secret) for shipments with no update in 24h. Don't book real shipments in tests; mock the HTTP layer.

### Prompt 21 · Reports
- `/admin/reports` with date range + compare (reuse `resolveRange` from `src/lib/server/dashboard.ts`) and CSV export per report: sales over time, by product and size, by state/city, prepaid vs COD + COD RTO rate, new vs returning, coupon performance, abandoned-cart recovery, revenue by UTM source/campaign (after Prompt 15), inventory value (stock × price). Add indexes via migration where queries need them; cache results 10 min (`"use cache"` + `cacheLife({ revalidate: 600 })`, tag `reports`).

### Prompt 17 · Admin users, roles, activity log
- Roles `owner | manager | staff` on `admin_users.role` (exists). Staff: orders, inquiries, reviews only; phone numbers masked. Managers: everything except users/settings/refunds. Owner: all. Enforce in server actions (`requireAdmin()` → add `requireRole(...)`) **and** hide sidebar items.
- Invite by email (Resend) with one-time set-password link (`admin_invites` table, token hash, 48 h expiry); remove user (never the last owner); show last login; password change bumps `session_version`.
- `activity_log` (created in Prompt 9): record every admin mutation (who, action, target, short before/after). Pages `/admin/settings/users` and `/admin/activity`.

### Prompt 19 · WhatsApp automation
- Provider-agnostic (Interakt or WATI by env `WHATSAPP_PROVIDER`, `WHATSAPP_API_KEY`) through an outbox like email. Templates: order placed, COD confirmation (customer replies YES/NO → provider webhook → order event + status `confirmed` or cancel), shipped, delivered + review link, abandoned cart (1 h and 24 h, max 2, opt-out STOP), back in stock (use `back_in_stock` rows, mark `notified_at`). Admin `/admin/messages`: templates on/off, test send, delivery log, opt-outs. Keep `wa.me` links as fallback when not configured.

### Prompt 18 · Customer accounts (OTP)
- Optional phone OTP login (provider via env; MSG91 or the WhatsApp provider). `customer_sessions` (signed cookie, like admin), `otp_codes` (hashed, 5-min expiry, rate-limited). My orders, one-tap reorder (adds the same variants to cart if in stock), saved addresses, track order. Guest checkout stays the default.

### Prompt 22 · Go-live final check (report only, then ADMIN_GUIDE)
Checklist per `ADMIN_PROMPTS.md` Prompt 22, then write `docs/ADMIN_GUIDE.md` in simple Hinglish for the client. Remember Prompt 6 (deploy) is on hold — list it as pending, don't do it.

---

## 8. Definition of done (every prompt)
- `npx tsc --noEmit` clean, `pnpm -s lint` 0 problems, `pnpm build` passes.
- New `pnpm test:<feature>` passes and cleans up after itself; existing `pnpm test:inventory`, `test:emails`, `test:settings`, `test:payu` (needs dummy `PAYU_KEY/SALT` temporarily) still pass.
- Pages you touched: no console errors at 1440px and 390px; screenshots in the report.
- One commit per prompt. Report: what changed, test output, anything not done and why.
