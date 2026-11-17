# Pre-launch audit: Swadeshi Mahadev Products

Date: 2026-11-17 · Branch `chat-assistant` · Audit only, no app code changed.
Method: type-check, lint, production build, safe test scripts, 7 read-only code reviews (auth, checkout,
orders, chatbot, security, perf/SEO, UI), browser checks at 1440px (Claude in Chrome) and 360px
(headless Chrome via Playwright, Pixel 5 profile). No orders placed, no OTP sent, no admin data changed.

---

## 1. Summary

**Readiness: 6 / 10.** The storefront looks and browses well, and pricing, PayU hash checks and ownership checks are solid.
Money-handling edge cases (refunds, shipments, cancels, extra payments) and a few security defaults must be fixed before real traffic.

**Top 5 problems (plain Hinglish)**
1. **Paisa double ja sakta hai:** admin do baar "Refund" daba de (ya 2 tab) to customer ko do baar refund ho sakta hai. Same tarah shipment do baar book ho sakti hai (do AWB, do charge).
2. **Prepaid order cancel = paisa atak gaya:** customer online-paid order (confirmed/packed) khud cancel kar sakta hai, stock wapas ho jaata hai, par refund ka koi step/alert nahi banta.
3. **Order cancel hone ke baad payment aaye to chupchap le liya jaata hai:** na admin ko alert, na refund flag, upar se "payment received" message bhi chala jaata hai.
4. **Login/OTP ki suraksha:** rate-limit fake IP header se bypass ho jaati hai (OTP SMS ka kharcha + brute force), login ke baad `?next=` se dusri website par bheja ja sakta hai, aur agar live par test-number OTP mode on hai to koi bhi owner ke number se login kar sakta hai.
5. **Mobile par buttons dab jaate hain + search kamzor:** chat wali Dadi ka button cookie "Accept" aur product page ke "Add to cart" ko dhak leta hai; "musturd" (typo) par 0 result, "sarson" par sirf 1 (Yellow Mustard gayab).

**Counts:** P0 = 6 · P1 = 28 · P2 = 30

---

## 2. Setup check (Part A)

| Check | Result |
|---|---|
| `tsc --noEmit` | ✅ 0 errors |
| `eslint src` | ✅ 0 errors, 1 warning: `src/components/checkout/CheckoutForm.tsx:374` React Hook Form `watch()` not memoizable (react-hooks/incompatible-library) |
| `pnpm build` | ⚠️ First run **failed** with `SecurityFatalError: Your version of Next.js is affected by a known security vulnerability` (Next **16.4.4**). Second run passed (exit 0) with the same warning. Next recommends `next upgrade --agent=security` (not run). |
| `test-cart-math` | ✅ 7/7 |
| `test-invoice-math` | ✅ 13/13 |
| `test-nimbuspost` | ❌ script broken: imports a `server-only` module ("cannot be imported from a Client Component") so it can't run under plain node |
| `test-chat` | 39/40: failed "baby massage ke liye kaunsa oil" (bot replied with a generic greeting, no oil named) |
| Other `scripts/test-*.mjs` (coupons, customers, inventory, payu, emails, invoices, reviews, tracking…) | **Not run**: they INSERT/UPDATE/DELETE the local DB or send email/WhatsApp. Run them against a throwaway DB. |
| `.gitignore` | ✅ `.env*` ignored, only `.env.example` tracked; no secret files in git history (checked file names only). ⚠️ `tmp/` is **not** ignored and `tmp/dadi-reference.jpg`, `tmp/frames/*.jpg` are committed (not secrets, just repo weight). |
| `NEXT_PUBLIC_*` | ✅ only public IDs (Cloudinary cloud name, site URL, GA/Ads/Meta/Clarity IDs, WhatsApp number) |
| Unused deps / bundle sizes | **Not checked**: Turbopack build output does not print per-route JS sizes; needs `@next/bundle-analyzer` run. |

---

## 3. Issues

Severity: **P0** blocks launch / loses money or data · **P1** hurts sales or trust · **P2** polish.
Effort: S < 1h · M = half day · L = 1 day+.

### P0

| ID | Area | What is wrong | Where | How to reproduce | Suggested fix | Effort |
|---|---|---|---|---|---|---|
| P0-1 | Orders/Refunds | Two concurrent refunds both pass the "amount left" check and both call PayU, so the customer is refunded twice. The comment saying a double click can't refund twice is wrong | `src/lib/server/refunds.ts:10-20`, `src/lib/server/orders.ts:827-844` | Open order in 2 tabs → Refund full amount in both | In one transaction: `SELECT … FROM orders WHERE id=? FOR UPDATE`, recompute left, INSERT `requested` row, commit, then call PayU | M |
| P0-2 | Shipping | `bookShipment` checks, calls NimbusPost, inserts after, with no lock. A race or retry books `SMPxxxx-2` as a second real shipment (2 AWBs, 2 charges); an insert failure orphans the AWB | `src/lib/server/shipments.ts:80-129` | Double-click "Book shipment" | Claim first (INSERT `shipments` row status `booking` under FOR UPDATE / unique guard), then call API | M |
| P0-3 | Account/Cancel | Customer self-cancel only blocks `status='paid'`; PayU orders in `confirmed`/`packed` can be cancelled → restocked, no refund, no flag | `src/lib/customer-account-actions.ts:252-275` | Pay online → admin confirms → customer cancels from My orders | Block self-cancel for any paid PayU order (allow only `pending_payment`/`payment_failed`), or turn it into a refund request | S |
| P0-4 | Payments | `markPaid` sets payment `success`, but the order update matches 0 rows when the order is already cancelled/paid; nothing is logged, and "payment_received" email + WhatsApp + invoice + Purchase event still fire. Second attempts happen on every `/checkout/pay` reload/new tab | `src/lib/server/orders.ts:521-577`, `src/lib/server/payu-process.ts:35-37,71-73`, `src/app/(site)/checkout/pay/page.tsx:46` | Cancel a pending order while PayU page open → pay; or pay twice from 2 tabs | When `affectedRows===0`: write order_event "extra payment, refund needed", alert admin, return flag, skip notifications/invoice/pixel | M |
| P0-5 | Auth | With no OTP gateway configured and `CUSTOMER_OTP_TEST_PHONES` set, those numbers log in with fixed `123456`, **and the code is returned to the browser as `devCode` and auto-filled**. Anyone typing the owner/staff number gets in | `src/lib/customer-account-actions.ts:28,50,69,78`; shown in `AccountWorkspace.tsx:67,145`, `layout/AccountMenuLogin.tsx:52,159` | On live (if env set): enter owner's number → OTP auto-fills | Never return `devCode` when `NODE_ENV==='production'`; test numbers use a secret env code. **Check live env now** (not verifiable locally) | S |
| P0-6 | Platform | Next.js 16.4.4 has a known security advisory; first build aborts with `SecurityFatalError` | `package.json` (next) | `pnpm build` | Upgrade Next to the patched version, rebuild, re-test | S–M |

### P1

| ID | Area | What is wrong | Where | How to reproduce | Suggested fix | Effort |
|---|---|---|---|---|---|---|
| P1-1 | Security | `clientIp()` trusts the first `x-forwarded-for` value (client-controlled), so every IP-keyed limit is bypassable: admin login, customer + chat OTP send (SMS bombing / cost), checkout, reviews, leads, chat LLM. OTP **verify** has no limit of its own, so with fresh OTPs (5 guesses each) a code can be brute-forced | `src/lib/server/rate-limit.ts:6-9`; `customer-account-actions.ts:58-63,87-117`; `chat-orders.ts:29,57`; `admin-login-actions.ts:21`; `api/chat/route.ts:81` | Send requests with a random `X-Forwarded-For` each time | Use the proxy-appended last hop / `x-real-ip`; add per-phone limits (5 sends/h, 10 failed verifies/h) and per-username admin lockout | M |
| P1-2 | Security | Rate limiter **fails open** on DB error, giving unlimited OTP sends and paid LLM calls during a DB blip | `src/lib/server/rate-limit.ts:27-29` | Stop DB briefly, hit `/api/chat` | Fail closed for OTP + `chat_answer` buckets, or in-memory fallback counter | S |
| P1-3 | Security | Open redirect: `safeNext` only rejects `//`; `/\evil.com` passes and browsers treat it as `//evil.com` | `src/app/(site)/login/page.tsx:14-17,44`, `src/components/customer/AccountWorkspace.tsx:81` | `/login?next=/%5Cexample.com` → log in | Reject `\` and control chars, or `new URL(v, origin)` + same-origin check | S |
| P1-4 | Security | WhatsApp webhook accepts unsigned POSTs when `WHATSAPP_APP_SECRET` is unset. Anyone could send "YES/NO" for any phone and confirm/cancel that customer's latest COD order (secret is set locally; prod not verified) | `src/app/api/whatsapp/webhook/route.ts:29-30,44-50` | Unset secret → POST a fake reply | Return 401 in production when secret missing | S |
| P1-5 | Security | PayU callback returns `orderToken` on the "invalid hash" and "duplicate" paths, then redirects to `/order?t=<token>`. txnid is guessable (`SMP{1000+id}T{base36 time}`), and the callback has no rate limit, so order pages with PII can leak | `src/lib/server/payu-process.ts:23,29`, `src/app/api/payu/callback/route.ts:23`, `orders.ts:344,450` | POST a forged callback with a guessed txnid | Return the token only after hash verifies; rate-limit the callback | S |
| P1-6 | Admin roles | Staff role can refund, change store settings, delete products and run shipping manifest/NDR actions (`requireAdmin()` lets every role in) | `src/lib/admin-actions.ts:139,154,194,207`, `src/lib/catalog-actions.ts:128` | Log in as staff → call refund | `requireRole("owner","manager")` (refund: owner only) | S |
| P1-7 | Orders | `setOrderStatus` has no transition rules: delivered→cancelled, pending_payment→delivered, cancelled→confirmed are all allowed. Courier webhooks also rewrite final states (late event moves delivered/cancelled → shipped) | `src/lib/server/orders.ts:742-765`, `src/lib/admin-actions.ts:112-118`, `src/lib/server/shipments.ts:191` | Admin sets a cancelled order to Confirmed | `ALLOWED_FROM[to]` map checked under FOR UPDATE; webhooks skip silently on illegal moves | M |
| P1-8 | Inventory | Cancelling a shipped/delivered/RTO order restocks goods that are with the courier/customer (inventory inflated) | `src/lib/server/orders.ts:763-764` | Cancel a shipped order in admin | Allow cancel only before dispatch; RTO path uses `markRtoReceived` | S |
| P1-9 | Shipping | `cancelOrderShipment` always resets status to `paid`/`cod_pending`, bringing a cancelled/refunded order back to life, and allows cancelling in-transit shipments | `src/lib/server/shipments.ts:141-145` | Cancel order → then cancel its shipment | Revert only from `packed`/`confirmed`; refuse in-transit | S |
| P1-10 | Refunds | A full refund on an unshipped order sets `refunded` but never restocks; admin manual "refunded" status moves no money | `src/lib/server/refunds.ts:30`, `orders.ts:763`, `admin-actions.ts:112` | Full refund before shipping → stock stays committed | Cancel + restock first on full pre-dispatch refund; remove `refunded` from manual list or require offline-refund note | S |
| P1-11 | Coupons | Usage limits (total, per phone, first-order) are only counted after PayU payment, so many pending PayU orders can each use a limited/first-order coupon | `src/lib/server/coupons.ts:59-80`, `orders.ts:378,557-570` | Open 3 PayU orders with a 1-use coupon → pay all | Reserve redemption in `createOrder` for all methods; release on fail/expiry | M |
| P1-12 | Checkout | Free-shipping check uses the pre-coupon subtotal in the UI but the post-coupon subtotal on the server, so the screen shows ₹0 shipping and the charge includes shipping | `src/lib/checkout-actions.ts:90,331`, `src/components/checkout/CheckoutForm.tsx:491` | Cart just above threshold + coupon → compare UI vs PayU amount | Same base on both sides | S |
| P1-13 | Chatbot | One request can try 4 Gemini + 2 Groq models × 25s timeout each (~150s) with no `maxDuration` | `src/lib/server/chat-ai.ts:162-216` | Providers slow/429 | One overall 12s deadline (shared AbortController), max 2-3 attempts, export `maxDuration` | S |
| P1-14 | Chatbot privacy | Phone/address/email/name typed by shoppers (message + 6 history turns) go to Google/Groq unredacted; `redact()` is used only for logs | `src/lib/server/chat-ai.ts:155-156,188-191`, `api/chat/route.ts:37-45,93` | Type address in chat | Run `redact()` on message + history before building the prompt | S |
| P1-15 | Chatbot | History comes from the client and is passed as real "model" turns, so fake assistant lines ("coupon FREE50 applies") can be planted. Prices stay server-side | `src/app/api/chat/route.ts:11`, `chat-ai.ts:155` | POST forged history | Keep history server-side by sessionId (or sign assistant turns); delimit user text | M |
| P1-16 | Privacy | Account deletion only sets `delete_requested_at`; nothing ever purges after the 7-day grace | `src/lib/server/account-profile.ts:445-450`, `customer-auth.ts:26` | Request deletion, wait 7 days | Cron to anonymise/delete rows past grace | M |
| P1-17 | Performance | Inline script hides the whole `body` (`opacity:0`) until hydration + fonts (≤800ms, 3s failsafe), which delays LCP on every page. Dev measurement on home: LCP 8.4s (dev mode, not representative, but the gate applies in prod too) | `src/components/motion/PageReady.tsx:10-26`, `src/app/(site)/layout.tsx:94-95`, `globals.css:491` | Throttle to slow 4G, watch blank page | Remove body-wide gate; animate only below-fold reveals | S |
| P1-18 | Performance | Hero `<picture>` with mobile `<source>` + `priority` on the desktop image: phones preload the desktop image and find their real LCP image late | `src/components/home/HeroCarousel.tsx:187-197` | Mobile network panel on `/` | `getImageProps()` art direction with media-scoped preloads | S |
| P1-19 | Performance | `proxy.ts` runs a DB query on every `/products/:handle` (and redirect + existence lookups on collections) before serving | `src/proxy.ts:45-70` | Any PDP request | Drop checks, rely on `notFound()`, or cache the handle list | S |
| P1-20 | Performance | ~17 font files: Figtree 5 weights, Mukta 4 weights latin+devanagari, Tiro normal+**italic (unused)** latin+devanagari, all preloaded | `src/app/(site)/layout.tsx:28-48` | Network panel | Tiro `style:["normal"]`, devanagari-only Mukta/Tiro, `preload:false` for them, Figtree 3 weights | S |
| P1-21 | SEO | Product JSON-LD: sold-out products have no `offers` (invalid), availability hard-coded `InStock`, and `aggregateRating` is emitted below the 5-review display threshold (policy violation) | `src/lib/utils/seo.ts:77-105`, `src/lib/utils/reviews.ts:5` | Rich Results Test on a sold-out / 2-review product | All variants with In/OutOfStock (or AggregateOffer); same `>= MIN_REVIEWS_FOR_RATING` gate | S |
| P1-22 | Reliability | No `error.tsx` / `global-error.tsx` anywhere, so a runtime error shows the bare Next error screen | `src/app/(site)/`, `src/app/` | Throw in a server component | Add branded `error.tsx` + `global-error.tsx` | S |
| P1-23 | SEO/Social | No default OG image (home has no `og:image`, verified in browser); only PDPs pass one, so WhatsApp/FB shares of home/shop/collections have no picture | `src/app/(site)/layout.tsx:62-69` | Share `/` on WhatsApp | Add `src/app/(site)/opengraph-image.png` 1200×630; pass collection/journal images | S |
| P1-24 | UI mobile | Chat launcher (64px, z-80) sits over the cookie banner's Accept button (verified at 360px on 6 pages), the PDP sticky "Add to cart", and the cart drawer/menu (z-50). Cookie banner and LoginNudge use the same bottom offset and stack | `src/components/chat/ChatWidget.tsx:750`, `product/ProductPurchase.tsx:207`, `ui/Drawer.tsx:80`, `marketing/ConsentManager.tsx:154`, `layout/LoginNudge.tsx:61` | 360px: open `/` (banner) or a PDP and scroll | Hide launcher while drawer/menu/sticky bar/banner shows (or lift it by their height); show nudges only after cookie choice | M |
| P1-25 | UI mobile | Home product card Add to cart and stepper are 32px; +/- buttons are 28px (below 40px touch target) | `src/components/home/PickCard.tsx:89,105,110,140,152` | 360px home "Top picks" | `h-10`, `size-9` stepper on mobile | S |
| P1-26 | Search | Plain substring match, so no typo tolerance and no Hindi/English synonyms. "musturd" gives 0 results; "sarson" gives 1 (Black Mustard only; **Yellow Mustard missing**); verified at 360px | `src/lib/commerce/providers/db.ts:127-134` | `/search?q=musturd`, `/search?q=sarson` | Synonym map (sarson→mustard, til→sesame, shahad→honey…) + fuzzy match (Levenshtein ≤1-2) over title/tags/Hindi | M |
| P1-27 | Auth | Session/guest-chat signing secret falls back to `"development-only-change-me"` if `ADMIN_SESSION_SECRET` is unset; for chat-orders the HMAC alone gates a phone's orders | `src/lib/server/customer-auth.ts:11`, `src/lib/server/chat-orders.ts:16` | Unset env in prod | Throw in production when unset (like admin-session) | S |
| P1-28 | Payments | `markPaymentFailed` for an old attempt frees the stock of a live retry; a payment marked `success` can be overwritten back to pending/failed (no status guard) | `src/lib/server/orders.ts:587-605`, `payu-process.ts:23` | Fail attempt A late while attempt B succeeds | Only fail order if no newer initiated/pending attempt; `AND status<>'success'` guards | S |

### P2

| ID | Area | What is wrong | Where | Suggested fix | Effort |
|---|---|---|---|---|---|
| P2-1 | Auth | OTP attempt counter is read-then-increment; parallel guesses exceed 5; correct code consumed non-atomically (2 sessions) | `customer-account-actions.ts:101-118`, `account-profile.ts:234-240` | `UPDATE … SET attempts=attempts+1 WHERE id=? AND attempts<5` + check rows; consume `WHERE used_at IS NULL` | S |
| P2-2 | Auth | OTP verify accepts an `email` from the client and keeps old "verified" status | `customer-account-actions.ts:94,125,131-133` | Drop `email` from login schema | S |
| P2-3 | Admin | Admin logout only deletes cookie; stolen token valid 7 days | `src/lib/admin-login-actions.ts:47-50` | Bump `session_version` on logout | S |
| P2-4 | Security | Raw `JSON.stringify` JSON-LD (admin-editable FAQ text) skips `<` escaping | `src/app/(site)/account/help/page.tsx:45` | Use `jsonLdString()` | S |
| P2-5 | Security | Public review upload signature reusable, no size limit | `src/lib/review-actions.ts:410-421`, `server/cloudinary.ts:56-75` | Signed preset with `max_file_size` / per-upload `public_id` | S |
| P2-6 | Security | CSP `script-src 'unsafe-inline'` in production | `src/lib/security-headers.ts:8` | Nonce/hash-based CSP | M |
| P2-7 | Checkout | Unsigned base64 cart cookie with duplicate lines can bypass per-line stock check → negative stock | `commerce/providers/db.ts:16-28`, `server/inventory.ts:51-68` | Merge lines by variant in `decode`; check summed qty | S |
| P2-8 | Checkout | NimbusPost down → flat quote `serviceable:true`, COD allowed anywhere | `src/lib/server/shipping.ts:73-76` | Block COD on API error path | S |
| P2-9 | Checkout | No server idempotency on `placeOrderAction`; 2 tabs/retry create 2 COD orders | `orders.ts:261-266`, `CheckoutForm.tsx:602` | Lock cart row FOR UPDATE, reject if already converted | S |
| P2-10 | Coupons | Cancelling an order doesn't return its coupon use | `orders.ts:742-764` | Delete redemption + recompute `used_count` on cancel | S |
| P2-11 | Orders | Self-cancel status/shipment check is outside the transaction | `customer-account-actions.ts:246-281` | `expectedFrom[]` checked under FOR UPDATE | S |
| P2-12 | Payments | PayU callback + webhook race → duplicate email/WhatsApp/Purchase | `payu-process.ts:23-37` | Conditional UPDATE, notify only if affectedRows=1 | S |
| P2-13 | Returns | Return window never closes if `delivered_at` is null (manual delivered) | `src/lib/account/order-actions.ts:35-43` | Fall back to delivered order_event time; deny if none | S |
| P2-14 | Refunds | Second partial refund writes no order_event | `orders.ts:755`, `refunds.ts:30` | `logEvent` directly | S |
| P2-15 | Refunds | Timeout reported as failure leaves refund retryable after PayU processed it | `refunds.ts:21-27` | Keep `requested` on unclear failure; reconcile via refund-status API | M |
| P2-16 | Chatbot | `chat_logs` kept forever; `redact()` only masks emails + 8+ digit runs | `sql/migrations/036_chat_logs_answers.sql`, `server/chat-logs.ts:12-16` | 90-day purge cron; wider redaction | S |
| P2-17 | Chatbot | `/admin/chat` page readable by staff (writes are role-checked) | `src/app/(admin)/admin/(workspace)/chat/page.tsx:24-27` | `requireRole("owner","manager")` | S |
| P2-18 | Chatbot | Cache key = sorted word set, so "A better than B" = "B better than A" | `api/chat/route.ts:155`, `chat-ai.ts:121-138` | Key on ordered normalised text | S |
| P2-19 | Chatbot | Cart add can happen on card mount without a tap; "same order again" adds all items | `components/chat/ChatCommerce.tsx:271-276`, `ChatWidget.tsx:416-423,495` | Require tap on Add (preselected) | S |
| P2-20 | Chatbot | Feedback vote not tied to session (client `msgKey`) | `api/chat/feedback/route.ts:14`, `chat-logs.ts:28-34` | Match `session_id` too | S |
| P2-21 | Chatbot | Output caps 1200/1500 tokens for <60-word replies; full catalog in every prompt | `chat-ai.ts:172,199`, `api/chat/route.ts:153` | Cap ~400 tokens | S |
| P2-22 | SEO | Layout sets `canonical:"/"`, inherited by login/account/checkout/order pages. Locally the canonical host is **.com** (`https://swadeshimahadevproducts.com/`); confirm prod `NEXT_PUBLIC_SITE_URL` is the `.in` apex | `src/app/(site)/layout.tsx:60` | Move canonical to home page metadata; verify prod env | S |
| P2-23 | SEO | Deprecated `priority` prop (Next 16 → `preload`) | `HeroCarousel.tsx:194-196`, `product/Gallery.tsx:170` | `preload` / `fetchPriority` | S |
| P2-24 | SEO | Sitemap `lastModified: now` for static pages/collections | `src/app/sitemap.ts:33-34` | Real updated-at or omit | S |
| P2-25 | SEO | `/order` blocked in robots and also noindex; FAQPage JSON-LD on every PDP has no effect; `host:` non-standard | `src/app/robots.ts:11`, `products/[handle]/page.tsx:285-293` | Pick one mechanism; drop FAQPage | S |
| P2-26 | UI | Hindi text with `leading-none`/`truncate` clips matras | `home/FeaturedCollections.tsx:151`, `home/RefinedVsGhani.tsx:60,66`, `home/PickCard.tsx:235`, `home/ShopByUse.tsx:190`, `chat/ChatCommerce.tsx:132` | `leading-snug`+ for Devanagari; `line-clamp` with 1.5 line-height | S |
| P2-27 | UI | Default easings instead of motion tokens; reduced motion only handled in chat; order celebration confetti ignores reduced motion | `ui/Drawer.tsx:74-75`, `ProductPurchase.tsx:206`, `HeroCarousel.tsx:84,89`, `MegaMenu.tsx:60`, `cart/CartLine.tsx:72`, `checkout/OrderCelebrate.tsx:10-27,94` | Use `EASE.*`; wrap `(site)` in `<MotionConfig reducedMotion="user">`; `disableForReducedMotion` | S |
| P2-28 | UI | Raw hex (`#1f7a3d` ×10 in CartDrawer, 21 hex in PicksSections, `#e8c879`, `#f6efe2`); primary buttons mix h-8…h-12 and rounded-full/xl | `cart/CartDrawer.tsx:183,265-503`, `home/PicksSections.tsx`, `CartLine.tsx:80`, `CheckoutForm.tsx:655,1381` | Tokens (`co-success`, `co-gold`, `khaki-soft`); one primary button class | M |
| P2-29 | UI | Small controls: drawer slider arrows 28px, upsell add 32px, size select 28px, remove 32px, "Clear all" 32px; LoginNudge `z-40` ineffective inside z-30 nav; toasts at fixed 76px offset | `CartDrawer.tsx:158,168,352`, `CartLine.tsx:93,134`, `ShopListing.tsx:342`, `MobileBottomBar.tsx:27,54`, `CartProvider.tsx:134` | `min-h-10` hit areas; portal nudge; CSS var offset | S |
| P2-30 | Misc | `/policies` (index) is a 404; `/cart` when empty shows Shop page (confirm intended); raw `<img>` without size in sticky bar; `tmp/` committed; `test-nimbuspost` script broken; lint warning in CheckoutForm | `ProductPurchase.tsx:213`, `.gitignore`, `scripts/test-nimbuspost.mjs` | Add policies index or redirect; width/height; ignore `tmp/`; fix script | S |

---

## 4. User journey results (Part C)

Screenshots (360px): `scratchpad/shots/m_*.jpg` (session scratchpad folder; temporary), combined views `combo1.jpg`, `combo2.jpg`.
Desktop 1440px: account menu screenshots from earlier this session.

| Journey | Result | Note |
|---|---|---|
| C1 First visit | **Partial** | 1440: home renders, no horizontal scroll, 1 H1, title/description OK, **no og:image**. 360: all 14 pages 200, no horizontal overflow; **chat launcher covers cookie "Accept"** on every page (P1-24). Dev LCP 8.4s (dev only). `m_.jpg` |
| C2 Discover | **Partial** | `/shop`, PDP (`/products/groundnut-oil`) load at 360. Search: "honey" OK, **"sarson" 1 result (Yellow Mustard missing)**, **"musturd" 0** (P1-26). PDP main image still blank ~2s after load at 360 (`m_pdp.jpg`), likely P1-17 gate + dev. Filters, lab report, reviews **not exercised**. |
| C3 Buy as guest | **Not tested** | Placing COD/PayU orders writes orders, takes stock and sends real email/WhatsApp; OTP needs a real phone. Logic reviewed in code (P0-4, P1-11/12, P2-7/8/9). |
| C4 After purchase | **Not tested** | Needs a placed order. Invoice/credit-note routes verified ownership-checked in code. |
| C5 Cancel/return | **Not tested** | Would change order data. Code review found P0-3, P1-8, P2-11/13. |
| C6 Account | **Partial** | Earlier this session at 1440: hover menu logged-in/out, keyboard nav, Esc, inline login phone step. Logout→login→"name not asked again" **not tested** (needs OTP); fix is in code (`customer-account-actions.ts` upsert). Mobile tap menu n/a (mobile uses bottom bar). |
| C7 Chatbot | **Partial** | `scripts/test-chat.mjs`: **39/40** (fail: "baby massage ke liye kaunsa oil" got a generic greeting). Manual prompts (Hindi greeting, prompt injection, fake card, cancel via chat) **not run in the browser**; code review: card/OTP blocked, no discount tool, cancel needs a button (P1-13/14/15, P2-16…21). |
| C8 Help & trust | **Partial** | Lab Reports, Our Ghani, Bulk orders, Contact, Track order, Login all 200 at 360 with correct H1/title. `/policies` index 404. Bulk/contact forms **not submitted** (would create leads + notifications). WhatsApp button not clicked. |
| C9 Admin | **Not tested** | Would change real data; admin password not to be entered. Role gaps found in code (P1-6, P2-3, P2-17). |
| C10 Edge cases | **Not tested** (mostly) | 404 page works (branded, noindex). Slow 3G, offline, back/refresh mid-checkout, 2 tabs, 200% zoom, keyboard-only, reduced motion **not run**. |

---

## 5. Security findings (P0 first)

1. **P0-5** Test-number OTP returned as `devCode` on live if `CUSTOMER_OTP_TEST_PHONES` set with no gateway → account takeover. *Check live env.*
2. **P0-6** Next.js 16.4.4 known vulnerability → upgrade.
3. **P1-1** Spoofable `x-forwarded-for` defeats all rate limits; OTP verify has no per-phone limit → OTP brute force + SMS cost abuse + admin login brute force.
4. **P1-2** Rate limiter fails open on DB error.
5. **P1-3** Open redirect via `/login?next=/\evil.com`.
6. **P1-4** WhatsApp webhook unsigned when secret missing → confirm/cancel any COD order.
7. **P1-5** PayU callback leaks order token on invalid hash.
8. **P1-6** Staff role can refund / change settings / delete products.
9. **P1-27** Signing secret falls back to a hard-coded default.
10. **P1-14/15** Chat PII to LLM; client-forged chat history.
11. **P2-1** OTP attempt race · **P2-2** unverified email on login · **P2-3** admin logout doesn't revoke · **P2-4** unescaped JSON-LD · **P2-5** reusable upload signature · **P2-6** `unsafe-inline` CSP · **P2-17** staff can read all chats.

Checked OK: admin actions all call `requireAdmin`/`requireRole` first; scrypt admin passwords with constant-time compare; NimbusPost + PayU hash/HMAC verification; parameterised SQL; account/order/address ownership checks; tracking returns masked data only; HSTS, X-Frame-Options DENY, frame-ancestors none (iframe embedding blocked, verified), nosniff, Referrer/Permissions-Policy.

---

## 6. Quick wins (< 15 min each)

- P0-3 block self-cancel of paid PayU orders (one condition).
- P0-5 never return `devCode` in production.
- P1-3 `safeNext`: reject `\`.
- P1-4 WhatsApp webhook: 401 when secret missing in prod.
- P1-5 return order token only after hash verifies.
- P1-6 swap `requireAdmin` → `requireRole` in 5 actions.
- P1-12 use the same subtotal for the free-shipping quote.
- P1-20 font config trims (italic, subsets, preload).
- P1-21 JSON-LD rating threshold + OutOfStock offers.
- P1-27 throw when signing secret missing in prod.
- P2-4 `jsonLdString` in help page · P2-17 role check on /admin/chat · P2-21 lower token caps · P2-23 `priority`→`preload` · add `tmp/` to `.gitignore`.

---

## 7. Fix plan

**Batch 1: money safety (do first).** P0-1, P0-2, P0-3, P0-4, P1-28, P2-12, P1-10, P1-9. Locks/claims around refunds, shipments and payments; extra-payment alert. Then run `test-payu`, `test-invoices`, `test-inventory` on a throwaway DB.

**Batch 2: security hardening.** P0-5, P0-6 (Next upgrade + rebuild), P1-1, P1-2, P1-3, P1-4, P1-5, P1-6, P1-27, P2-1, P2-2, P2-3, P2-4. Verify live env vars (`CUSTOMER_OTP_TEST_PHONES`, `WHATSAPP_APP_SECRET`, `ADMIN_SESSION_SECRET`, `NEXT_PUBLIC_SITE_URL`).

**Batch 3: order rules + checkout correctness.** P1-7, P1-8, P1-11, P1-12, P1-16, P2-7, P2-8, P2-9, P2-10, P2-11, P2-13, P2-14, P2-15.

**Batch 4: conversion + speed + SEO.** P1-17, P1-18, P1-19, P1-20, P1-21, P1-22, P1-23, P1-24, P1-25, P1-26 (search synonyms/typos), P2-22…P2-25.

**Batch 5: chatbot + polish.** P1-13, P1-14, P1-15, P2-16…P2-21, P2-26…P2-30. Then the untested journeys C3-C5, C9, C10 on a staging copy with PayU test mode.

---

## 8. Batch 1 status (money safety), 2026-11-17

Code changed, **not committed** (waiting for review). New migration `sql/migrations/037_order_attention.sql` (`orders.attention`, `attention_at`): applied to the local DB with `pnpm db:setup`. **Must also be applied on Hostinger before deploying this code.**
Admin sees flagged orders as a red "Needs attention" banner on the order page (`src/components/admin/order/AttentionBanner.tsx`, "Mark resolved" with a note). Helper: `flagOrder()` `src/lib/server/orders.ts:156`.

| ID | Status | Fix |
|---|---|---|
| P0-1 | **Fixed** | `src/lib/server/refunds.ts:21`: order row `FOR UPDATE`, balance recomputed in-tx, `requested` row inserted before commit, PayU called after commit, conditional `WHERE status='requested'` update. Timeout/network answer (`payu.ts` `uncertain`) keeps the row on hold + flags the order (`refunds.ts:59`) |
| P0-2 | **Fixed** | `src/lib/server/shipments.ts:88-95`: claim row `status='booking'` inserted under the order lock, NimbusPost called after commit; API rejection cancels the claim + timeline note; timeout keeps the claim + flags the order; save failure after booking flags with the AWB. Messages only if the order status changed |
| P0-3 | **Fixed** | `src/lib/server/order-cancel.ts:25` (`customerCancelOrder`): paid PayU orders (paid/confirmed/packed) never self-cancel; status move uses `onlyFrom` under the lock. `requestOrderCancel` (`:41`) creates one `cancel` help ticket (reuses the open one) + team alert + order flag. Rule shared in `help-lib.ts cancelRule/isPaidOnline`; UI: "Cancel request bhejein" (`OrderDetailClient.tsx CancelOrderButton`, `OrderCard.tsx` toast action) |
| P0-4 | **Fixed** | `src/lib/server/orders.ts:569` `markPaid` returns `paid`/`duplicate`/`extra`; order locked first; payment for a cancelled / already-paid order → `extra` → flag "Extra payment ₹X… refund it", no email/WhatsApp/invoice/pixel. Callers notify only on `paid` (`payu-process.ts:9,43` + reconcile + return-verify) |
| P1-28 | **Fixed** | `orders.ts:659` `markPaymentFailed`: never overwrites a `success` payment; fails the order / releases stock only when no other attempt is initiated/pending/success. `markPaid` guard `status <> 'success'` (`orders.ts:581`) |
| P2-12 | **Fixed** | Conditional payment update in `markPaid` → callback + webhook race sends one email, one WhatsApp, one pixel event |
| P1-10 | **Fixed** | Full refund of a paid/confirmed/packed order with no live shipment restocks (`refunds.ts:80` → `setOrderStatus(..., { restock })`, `orders.ts:855`). Manual "Refunded" status: blocked while PayU balance is refundable, needs an offline-refund note otherwise (`admin-actions.ts:121`) |
| P1-9 | **Fixed** | `shipments.ts:195`: only `booked` shipments (or a stuck `booking` claim with no AWB) can be cancelled; in-transit refused; order reverts only from `packed` (`:215`), otherwise a timeline note |

**Tests**
- `scripts/test-money-safety.mjs` added: runs only with `TEST_DATABASE_URL` (refuses if unset, same as the main DB, or the DB name lacks `_qa`/`_test`). Real server code, with PayU/NimbusPost/mail/WhatsApp/invoice/pixel mocked and `fetch` blocked. It covers concurrent refunds, refund timeout, concurrent bookings, booking timeout, paid-order cancel request, COD cancel, extra payment (cancelled + already paid), callback/webhook race, old failed attempt vs new attempt, success never downgraded, shipment cancel on cancelled/refunded/packed/in-transit orders.
  **Result: 26/26 PASS** on the QA database (run 2026-11-17; the QA DB was also brought up to migration 037).
- `tsc --noEmit` ✅ · eslint on changed files ✅ (0 errors, 0 warnings) · `test-cart-math` 7/7 ✅ · `test-invoice-math` 13/13 ✅ · `test-chat` 40/40 passed ✅

---

## 9. Batch 2 status (security), 2026-11-17

Not committed (waiting for review). Hostinger env checked by name only (values never read): `ADMIN_SESSION_SECRET` ✅ set, `WHATSAPP_APP_SECRET` ✅ set, `NEXT_PUBLIC_SITE_URL` ✅ live canonical is `https://swadeshimahadevproducts.in`, `CUSTOMER_OTP_TEST_PHONES` ⚠️ set (inactive live because the WhatsApp OTP gateway is configured; with this batch it also needs a secret `CUSTOMER_OTP_TEST_CODE`, which is not set, so test numbers are off). `TRUSTED_PROXY_HOPS` not set (default 1).

| ID | Status | Fix |
|---|---|---|
| P0-5 | **Fixed** | `src/lib/customer-account-actions.ts:38,86`: fixed code returned only in local dev (`devMock`); live test numbers need secret `CUSTOMER_OTP_TEST_CODE` (never sent to the browser), off when unset |
| P0-6 | **Fixed** | `next` 16.4.4 → **16.4.6** (advisory: info disclosure via `use cache` + `unstable_cache`, patched ≥16.4.5), `eslint-config-next` 16.4.6, `@next/mdx` ^16.4.6 |
| P1-1 | **Fixed** | `src/lib/server/rate-limit.ts:12` `clientIp()` takes the proxy-appended XFF hop (`TRUSTED_PROXY_HOPS` from the right, default 1) instead of the client-sent first entry. New IP-independent limits: OTP send 5/h per phone (`customer-account-actions.ts:70`), wrong OTP 10/h per phone (`:112`), admin login 10/30min per username (`admin-login-actions.ts:28`) |
| P1-2 | **Fixed** | `rate-limit.ts:24,52`: DB error → in-memory per-process counter instead of "allow all" |
| P1-3 | **Fixed** | New `src/lib/utils/safe-path.ts` (`safeInternalPath`: rejects `//`, `\`, encoded variants, control chars, other origins); used in `login/page.tsx:15` and client `AccountWorkspace.tsx SignIn` |
| P1-4 | **Fixed** | `src/app/api/whatsapp/webhook/route.ts:34`: no secret in production → reject |
| P1-5 | **Fixed** | `src/lib/server/payu-process.ts:35`: hash/udf1 verified before the duplicate check; invalid → no order token. Callback rate-limited 30/10min per IP (`api/payu/callback/route.ts:11`) |
| P1-6 | **Fixed** | owner/manager only: store settings (`admin-actions.ts:215`), daily manifest (`:147`), NDR (`:162`), product bulk delete (`catalog-actions.ts:136`), starter import (`:145`). Refund was already owner-only (audit item partly wrong) |
| P1-27 | **Fixed** | `customer-auth.ts:15`, `chat-orders.ts:20`: throw in production if `ADMIN_SESSION_SECRET` unset (it is set live) |
| P2-1 | **Fixed** | Atomic attempt counter + single consume: `customer-account-actions.ts:121`, `account-profile.ts:242` |
| P2-2 | **Fixed** | OTP login no longer writes `email` (schema still accepts it for old clients; ignored) |
| P2-3 | **Fixed** | Admin logout bumps `session_version` (`admin-login-actions.ts:57`), so the token dies server-side (logs that admin out on all devices) |
| P2-4 | **Fixed** | `account/help/page.tsx:46` uses `jsonLdString()` |

**Behaviour changes to know**
- If the live site sits behind more than one proxy (e.g. CDN + LiteSpeed), set `TRUSTED_PROXY_HOPS=2`; otherwise all visitors may share one IP bucket. Check after deploy: two phones on different networks should not hit "Too many attempts" together.
- Admin logout now logs that admin out on every device.
- Staff can no longer change store settings, run manifests/NDR, or bulk-delete products.

**Tests** (after Next 16.4.6): `tsc` ✅ · `eslint src` ✅ 0 errors (1 old warning, `CheckoutForm.tsx:374`) · `pnpm build` ✅ exit 0, **no `SecurityFatalError`** · `test-cart-math` 7/7 · `test-invoice-math` 13/13 · `test-money-safety` 26/26 · `test-chat` 40/40 (an earlier run gave 38/40 without saved details; the re-run with full output passed all) · dev server restarted on 16.4.6 (stale browser tabs need a hard refresh)
