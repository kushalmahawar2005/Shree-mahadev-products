# Handoff: Shree Mahadev store (2026-11-13)

Read `AGENTS.md` and `docs/UI_WORKFLOW.md` first (owner preferences, libraries, patterns, verify steps).
Owner writes Hinglish; reply short Hinglish. Commit only when the owner asks. Deadline to client ~2026-11-25.

---

## 1. Live site (Hostinger)

- URL: https://swadeshimahadevproducts.in (Hostinger account `u892494227`, Node.js app, Node 22).
- Hostinger MCP (`hostinger-hosting` tools: search / execute) is connected and works.
- DB: Hostinger MySQL `u892494227_smp`, user `u892494227_smp_app`. App connects to `127.0.0.1:3306`.
  Local Docker DB (`smp-mysql`) was copied there on 2026-11-13 (54 tables, 18 products, 77 orders).
  Since then live and local DBs are separate (live has new orders, e.g. #319).
  hPanel showed the DB as "not assigned" to the domain after the domain rename; harmless, can be
  re-linked with Databases → "Assign from plan".
- Env vars are set on Hostinger (same keys as `.env.local`, with `NEXT_PUBLIC_SITE_URL=https://swadeshimahadevproducts.in`
  and the Hostinger DB values). Set them with `hosting_nodejs_replace-environment-variables`
  (FULL replace: always send every key). PayU is still TEST mode. `RESEND_API_KEY` is empty, so emails sit in the outbox.
- Admin login on live still uses `ADMIN_PASSWORD=admin123` (env). Must be changed.

### How to deploy (IMPORTANT)
Hostinger's own `next build` hangs on "Creating an optimized production build" and is killed at ~15 min.
So we build locally and upload a prebuilt standalone app:

```bash
scripts/hostinger-build.sh          # builds working tree → /tmp/smp-deploy/smp-deploy.zip (~135 MB)
```
Then deploy with the Hostinger MCP:
`hosting_deploy` { domain: "swadeshimahadevproducts.in", path: "/tmp/smp-deploy/smp-deploy.zip", type: "nodejs",
appType: "next", nodeVersion: 22, packageManager: "pnpm", buildScript: "build:prebuilt", outputDirectory: ".next" }
→ poll `hosting_get-deployment` (takes ~30 s). Then curl a few pages.

What the script does: copies only git-known files (not `.next-qa`, `tmp/`, `output/`, `public/videos/`, `.env*`),
adds `output: "standalone"` to next.config + `.npmrc node-linker=hoisted` + a no-op `build:prebuilt` script
(staging copy only, repo unchanged), builds with the live site URL, replaces leftover symlinks, copies `public` and
`.next/static` into `.next/standalone`, removes macOS sharp binaries, checks no secret is inside, zips.
Test locally before deploying: `cd /tmp/smp-deploy/deploy/.next/standalone && PORT=3107 node server.js` (with DB env).

- GitHub auto-deploy is ON for `main` (repo kushalmahawar2005/Shree-mahadev-products). A push triggers a server
  build that FAILS (site stays on the last good version). Either disable it in hPanel or commit
  `output: "standalone"` and accept failed builds. Don't rely on push-to-deploy.
- Hostinger runtime logs only show JSON lines, so Next.js errors don't appear there.

### Cron jobs on Hostinger (keep site warm)
- `*/5 * * * *` curls `/`, `/shop`, `/products/groundnut-oil` (uid 2I5LDwaE5M).
- `*/10 * * * *` curls every URL in `/sitemap.xml` (uid EriqMv2bts).
Reason: un-visited pages took 9–34 s on first hit (cache expiry / cold process). Warm pages answer in 0.2–0.7 s.
Note the app's own crons (PayU reconcile, abandoned carts, outbox, etc. — see routes using `CRON_SECRET`) are
NOT set up on Hostinger yet.

---

## 2. Done this session (speed) — deployed live, NOT committed

- Videos moved from `/public/videos` to Cloudinary `swadeshi-mahadev/videos/...` (uploaded + eager renditions
  480/640/960 H.264, because Cloudinary returns 423 on the first on-the-fly video transform).
  - `src/lib/site-videos.ts` (`siteVideo()`, `siteVideoUrl()`), `cldVideo()` in `src/lib/image-loader.ts` now snaps
    to 480/640/960 with `q_auto,vc_h264`; `VIDEO_EAGER` is sent on admin reel uploads
    (`src/lib/server/cloudinary.ts` signUpload + `src/components/admin/media/upload.ts`).
  - Updated: home page reels fallback, PDP reels, FilmShowcase, BrandFilm, StoryBits, PicksSections, ProofSection,
    `src/data/pdp-story.ts`. `public/videos` is excluded from the deploy (files still in repo).
- Icons: `src/components/icons/duo.tsx` now draws only Phosphor's duotone artwork from generated
  `src/components/icons/duo-paths.ts` (`node scripts/gen-duo-icons.mjs` after adding an icon). Saved ~35 KB gz per page.
- zod removed from the client bundle: `DEFAULT_SETTINGS` + `liveAnnouncements` moved to
  `src/lib/store-settings-defaults.ts` (re-exported from `store-settings.ts`); `StoreSettingsProvider` imports that.
- `canvas-confetti` now lazy-loaded (`CartProvider.tsx`, `FreeShippingBar.tsx`).
- DB/query check: not the bottleneck (all storefront queries ~45 ms total, indexes fine, lists already paginated).
- Verified: tsc + eslint clean on changed files; local standalone smoke test (pages + CSS 200); live pages 200.

Uncommitted files also include `src/data/hero.ts`, `public/images/dadi/`, `public/images/hero/` — NOT from this
session's work; ask the owner before committing them. `tmp/` is junk, don't commit.

---

## 3. IN PROGRESS: NimbusPost / admin action errors ("Minified React error #441")

Owner screenshot: admin order #319 → Shipping panel shows "Minified React error #441".
Cause: in production, an Error thrown inside a server action is hidden; the client only gets #441
("error in Server Components render"). So the real NimbusPost/booking message is lost.

Plan (not started in code yet):
1. Add `src/lib/action-result.ts`: `type ActionResult<T> = {ok:true,data:T}|{ok:false,error:string}` and
   `unwrap(r)` (throws `new Error(r.error)` on the client).
2. Add a server helper `safe(fn)` that runs fn, returns `{ok:true,data}`, catches errors → `{ok:false,error:message}`,
   and calls `unstable_rethrow(e)` first so redirects/notFound from `requireAdmin()` still work. `console.error` the error.
3. Wrap all 15 actions in `src/lib/admin-actions.ts` (markReminderSent, quoteCouriers, bookShipment, cancelShipment,
   refreshTracking, setOrderStatus, labelUrl, requestPickup, createDailyManifest, listNdr, ndr, verifyPayment,
   resendOrderEmail, refundOrder, saveStoreSettings) + `markRtoReceivedAction` in `src/lib/inventory-actions.ts`.
4. Update callers with `unwrap(await xAction(...))`: `ShipmentPanel.tsx`, `shipping/page.tsx`, `RefundPanel.tsx`,
   `order/PaymentPanel.tsx`, `OrderEmails.tsx`, `RemindButton.tsx`, `AbandonedCartsWorkspace.tsx`, `SettingsForm.tsx`.
   Same issue likely exists in other `*-actions.ts` files used by admin (inquiry, coupon, review, catalog...): check them too.
5. Deploy, then on order #319 click "Compare courier rates" / Book and read the real NimbusPost error, fix that
   (check NIMBUSPOST_* env, warehouse name "Swadeshi Mahadev Products", pickup pincode 305624, API key vs email login).
   NEVER book a real shipment while testing unless the owner says so.

---

## 4. TODO: admin features the owner asked for ("saare karo ek dam proper")

All in admin style (see UI_WORKFLOW.md §4: shadcn, motion, cards, status pills, AlertDialog confirmations,
`requireAdmin()` + zod in actions, add nav item in `ADMIN_NAV` in `src/components/admin/AdminShell.tsx`;
STAFF_PAGES/OWNER_ONLY control roles).

1. **Returns** (table `order_returns`: order_id unique, customer_id, items JSON [{variantKey,qty}], reason, note,
   status requested|approved|rejected|received|refunded). Customer creates it in
   `src/lib/account/order-actions.ts` (only logs an order_event; order status stays `delivered`).
   Build: list with filters + detail (order no, customer, items with titles/photos from order_items, reason, note),
   actions Approve / Reject (reason) / Mark received / Mark refunded (link to order page RefundPanel; credit notes in
   `src/lib/server/credit-notes.ts` already read `status='refunded'`). Write order_events on each change.
   Notify customer (WhatsApp/email outbox) if helpers exist. Also show a "Return requested" badge on the order page/list.
2. **Support tickets inbox** (tables `support_tickets`: ticket_no, customer_id, order_id, issue, message, utr,
   contact_pref, callback_slot, status open|in_progress|resolved; `support_ticket_photos`). Customer side:
   `src/lib/server/support-tickets.ts`, `src/components/account/help/help-lib.ts` (status labels).
   Build: inbox with status tabs, ticket detail (customer, linked order, photos, UTR, callback slot, WhatsApp/call
   buttons), change status. Suggest one "Help desk" page with Returns + Tickets tabs, count badge in sidebar.
3. **Back-in-stock list** (table `back_in_stock`; today only visible inside WhatsApp workspace
   `src/components/admin/WhatsAppWorkspace.tsx`, helpers in `src/lib/server/inventory.ts` / `whatsapp.ts`):
   page/section grouped by product+variant with waiting count, contacts, "notify now" when restocked.
4. **PDP story content editable** (now hard-coded in `src/data/pdp-story.ts` per category: checks, reels, etc.):
   move to DB (`settings` table JSON or new table + migration in `sql/migrations/`), admin editor, fall back to the
   current file values. Revalidate with `updateTag()`.
5. **FAQ feedback report** (table `faq_feedback`, written by `recordFaqFeedback` in support-tickets.ts):
   small report (helpful vs not per FAQ id) e.g. inside Reports or the Help desk page.

Verify each: `pnpm exec tsc --noEmit`, `pnpm exec eslint <paths>`, local check, then deploy via §1.

---

## 5. Other pending (from earlier list)

- Change admin password on live; set `RESEND_API_KEY` + verify sending domain; PayU live keys + one real test;
  NimbusPost real booking test + webhook URL on live domain; set up the app's cron routes on Hostinger;
  clean test orders (SMP1182, order 316, dummy carts, demo hero banner id 3); check legacy redirects on live.
- Client still owes: hair oils / seeds / oil cake lists+prices, some photos (Black Sesame, Black Mustard 500ml front
  & 15L, Walnut 1L, Jaggery Block 1kg), real hero banners, honey variants.
- Old-style admin pages still to redesign (see UI_WORKFLOW.md §7).
- Pay page creates a new PayU attempt on every render (duplicate attempts); tracking label "Waiting for payment" →
  "Order placed".
- More speed ideas not done: motion → LazyMotion, smaller home HTML (695 KB, 347 image URLs), PageSpeed before/after.

---

## 6. Update 2026-11-13 (later session) — NOT committed

- §3 done in code: `src/lib/action-result.ts` (`safe()` server / `unwrap()` client). Every admin `*-actions.ts`
  (admin, inventory, media, catalog, collection, whatsapp, admin-user, helpdesk, pdp-story) returns
  `ActionResult`; all callers use `unwrap(await x())`. Deployed live (build 01a1d3c4). Still TODO: owner opens
  order #319 → "Compare courier rates" and sends the real NimbusPost error.
- Webhooks set by owner: NimbusPost + PayU → `https://swadeshimahadevproducts.in/api/{nimbuspost,payu}/webhook`.
- §4 built (local only, not deployed yet):
  - `/admin/helpdesk` (nav "Help desk", sidebar count badge): tabs Returns (approve/reject/received/refunded,
    writes order_events), Tickets (status, photos, UTR, WhatsApp/call), Back in stock (grouped, "Notify" queues
    WhatsApp `back_in_stock` + sets notified_at), FAQ feedback. Server: `src/lib/server/helpdesk.ts`,
    actions `src/lib/helpdesk-actions.ts`, UI `src/components/admin/helpdesk/HelpdeskWorkspace.tsx`.
    Order page shows a "Return <status>" badge.
  - `/admin/product-stories`: editor for PDP method/checks/reels per category, saved in `settings` key
    `pdp_story` (no migration), falls back to `src/data/pdp-story.ts`. PDP reads `getPdpStories()` (tag `pdp-story`).
- Order confirmation: `OrderCelebrate` now shows a ~2 s full-screen "Payment successful / Order placed" intro
  (tick draws, amount), circle-reveal exit, then confetti; hero uses animated `SuccessTick`.
- Verified: tsc + eslint clean, SQL run on local DB, routes compile. NOT browser-checked logged-in yet.
- Reels simplified (2026-11-13): ONE admin page "Reels" (`/admin/videos`) with "Shows on" ticks per reel
  (home / oil / honey / sweetener). New column `reels.placements` → **migration 031 must run on the live DB
  before deploying** (`pnpm db:setup` against Hostinger DB). Home reads reels ticked "home"; PDP reads reels
  ticked for its category, falling back to built-in clips. "Product page content" (`/admin/product-stories`)
  now only edits method steps + at-home checks. Instagram links removed (embed sends visitors to the app);
  only upload (auto-compressed on Cloudinary, `VIDEO_INCOMING`) + YouTube links. Menu section renamed "Website".
- Deployed live 2026-11-13 (build 01a1d50d): everything above. `scripts/hostinger-build.sh` now sets
  `build:prebuilt` = `node scripts/db-setup.mjs`, so pending migrations run on the server with the live env at
  every deploy (031 applied live). Customer OTP: `CUSTOMER_OTP_TEST_PHONES` (comma list) lets only those numbers
  sign in with 123456 while no OTP gateway exists; owner still has to add it (and `RESEND_API_KEY`) in hPanel.
- Fixed the "build hangs after saving env vars" problem: hPanel env save triggers a rebuild with the stored
  `build` script. The deploy zip now sets BOTH `build` and `build:prebuilt` to `node scripts/db-setup.mjs`
  (migrations only; the app is the prebuilt .next). Deploy with `buildScript: "build"` (build 01a1d518 live).
