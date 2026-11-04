# Swadeshi Mahadev Admin Guide

Yeh guide daily admin kaam ke liye hai. Admin panel `/admin` par milta hai.

## Launch status

| Check | Status |
|---|---|
| TypeScript, lint, production build | PASS |
| Tracking regression tests | PASS |
| Admin roles, invites, activity log | Built |
| Reports, shipping/NDR, marketing tracking | Built |
| WhatsApp automation | Built; provider keys/configuration pending |
| Customer OTP account | Built; OTP provider configuration pending |
| Hostinger deployment | **PENDING — Prompt 6 hold par hai** |
| Live COD/PayU/NimbusPost/email/ads tests | Client credentials aur live services ke baad karne hain |
| Lighthouse mobile 90+, axe, real-device QA | Is environment mein run nahi hua; launch se pehle run karein |

## Pehli baar setup

1. Database migrations chalayein:
   `pnpm db:setup`
2. `ADMIN_SESSION_SECRET` ko long random value rakhein.
3. Owner banayein:
   `pnpm admin:create owner StrongPasswordHere owner`
4. Admin login `/admin/login` se karein.
5. **Settings → Admin users** se manager/staff ko invite karein.
6. Invite link 48 hours mein expire hota hai. Owner ko activity log mein invite/remove events dikhte hain.

## Roles

- **Owner:** poora panel, settings, refunds, admin users aur activity log.
- **Manager:** sales, catalog, marketing, messages, shipping aur reports. Settings, refunds aur users nahi.
- **Staff:** orders, inquiries aur reviews. Phone numbers masked rakhein.

## Roz ka workflow

### Orders

**Orders** mein pending orders dekhein. Order open karke payment, address, notes aur shipment status check karein. Status manually badalne ke liye sirf valid workflow use karein:

`COD pending → Confirmed → Packed → Shipped → Delivered`

COD customer confirmation ke liye WhatsApp automation configured ho to customer ka `YES/NO` reply process hota hai. Provider configured na ho to order page ka WhatsApp fallback use karein.

### Shipping

**Shipping ops** mein courier quote, shipment booking, label, pickup aur tracking refresh available hain. NDR cases mein:

- Re-attempt: courier ko dobara delivery try karne dein.
- Change address/phone: customer details verify karke update karein.
- RTO: parcel return process mark karein.

Real shipment booking test environment mein na karein; NimbusPost wallet charge ho sakta hai.

### Products aur inventory

Product, variant price, SKU, availability aur stock **Products/Inventory** se manage karein. Har manual stock change ka reason likhein. Stock zero hone par storefront par out-of-stock/notify option dikhta hai.

### Marketing aur messages

- **Marketing:** consent, attribution, feeds aur server events.
- **Messages:** WhatsApp templates on/off, outbox process, delivery log aur opt-out.
- Provider ke liye `WHATSAPP_PROVIDER`, `WHATSAPP_API_KEY`, `WHATSAPP_API_URL`, `WHATSAPP_WEBHOOK_SECRET` configure karein.
- Customer OTP ke liye `CUSTOMER_OTP_PROVIDER`, `CUSTOMER_OTP_API_KEY`, `CUSTOMER_OTP_API_URL` configure karein.
- Templates ko provider dashboard par approve karwana zaroori hai.

### Reports

**Reports** mein date range aur comparison select karein. Sales, products/size, location, COD/prepaid, RTO, customers, coupons, abandoned carts, UTM aur inventory value reports CSV mein export ki ja sakti hain.

### Customers

Customer phone OTP se `/account` par sign in kar sakta hai. Wahan orders, reorder aur saved addresses milte hain. Guest checkout default bana hua hai; account banana compulsory nahi hai.

## Cron jobs

Hostinger cron mein app URL ko `x-cron-secret` header ke saath call karein:

- `/api/cron/payu-reconcile` — pending PayU payments
- `/api/cron/tracking-refresh` — stale shipment tracking
- `/api/cron/marketing` — marketing outbox
- `/api/cron/whatsapp` — abandoned cart, back-in-stock aur WhatsApp outbox

`CRON_SECRET` ko public na karein. Cron response aur failed outbox rows periodically check karein.

## Go-live checklist

- [ ] MySQL backup aur restore test complete.
- [ ] `pnpm db:setup` production database par complete.
- [ ] Admin, PayU, NimbusPost, Cloudinary, Resend, WhatsApp aur OTP secrets rotate/configure.
- [ ] PayU live keys aur webhook URL verify.
- [ ] NimbusPost pickup, wallet, webhook aur label test verify.
- [ ] Resend domain SPF/DKIM verify.
- [ ] Meta/GA4/Google Ads optional IDs configure karke purchase event verify.
- [ ] COD aur PayU test orders end-to-end verify.
- [ ] Cancellation, refund, RTO aur delivered flows verify.
- [ ] Lighthouse mobile home, collection, PDP, checkout par 90+ target verify.
- [ ] axe accessibility scan home, PDP, checkout, admin login par run.
- [ ] Sitemap, robots, redirects aur structured data Search Console mein verify.
- [ ] Real catalog prices/photos check; test/TODO values live na hon.
- [ ] Cron jobs aur error monitoring configure.
- [ ] Hostinger deployment ke baad SSL, domain, health check aur rollback verify.

Deployment abhi intentionally nahi kiya gaya hai. Prompt 6 hold se release hone par backup ke baad deploy karein.

## Emergency rules

- Suspicious admin login ho to owner password reset karein; password change session invalidates karta hai.
- Secret leak ho to provider dashboard par revoke/regenerate karein, phir Hostinger env update karein.
- Payment mismatch ho to order ko manually paid na karein; PayU reconciliation aur payment logs check karein.
- NimbusPost booking doubt ho to dobara book na karein; shipment/AWB aur provider dashboard pehle verify karein.
