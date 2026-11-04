# PayU test plan

Run in **PayU test mode** (`PAYU_MODE=test` + test key/salt from the PayU dashboard). Use PayU's published test cards/UPI from their docs (test card numbers change; don't hard-code them here).

## Automated (no real money, works with dummy keys)
`pnpm test:payu` (dev server running) — **6/6 pass on 2026-11-04 with dummy keys**:
forged webhook ignored · valid hash but unconfirmed → stays pending · failure callback → payment_failed + redirect to order page · cron route rejects missing secret and runs with it.

## Manual cases (need PayU test keys)
| # | Case | Steps | Expected |
|---|---|---|---|
| 1 | Success | Checkout → Pay online → PayU test success | `/order` shows "confirmed"; admin order **Paid**; payment row success; stock committed; "Payment received" + store email queued |
| 2 | Failure | Use PayU's failing test card/UPI | Order **payment_failed**; held stock released; "Try payment again" on `/order` |
| 3 | User cancel | Click Cancel on PayU page | Same as failure |
| 4 | Retry | From case 2/3 click "Try payment again" | New txnid, stock re-held, success marks Paid once |
| 5 | Double submit | Refresh/repost the PayU return | Only one Paid event, one email (dedupe) |
| 6 | Closed browser | Pay, close tab before redirect | S2S webhook `/api/payu/webhook` marks Paid; or `pnpm payu:reconcile` after 15 min |
| 7 | Amount tamper | Change amount in the form (devtools) | Hash mismatch → not paid |
| 8 | Full refund | Admin order (owner) → Refund full amount | Refund row success; order **Refunded**; refund email |
| 9 | Partial refund | Refund less than paid | Order **Partly refunded**; refundable shows the rest |

## Dashboard setup (after go-live)
- **Webhook:** PayU Dashboard → Webhooks → Payments (success, failure) → `https://swadeshimahadevproducts.com/api/payu/webhook`
- **Cron (Hostinger, every 15 min):** `curl -s -H "x-cron-secret: $CRON_SECRET" https://swadeshimahadevproducts.com/api/cron/payu-reconcile`
- Live keys: `PAYU_MODE=live`, `PAYU_KEY`, `PAYU_SALT`; website must be approved by PayU (policy pages are live).
