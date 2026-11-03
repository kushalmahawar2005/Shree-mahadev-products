This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Orders, payments, deploy (Hostinger)

**Local:** `docker start smp-mysql` (MySQL on port 3319), `pnpm db:setup`, `pnpm dev`. Values in `.env.local`.

**Flow:** cart → `/checkout` (address + PayU/COD) → order row in MySQL →
PayU: `/checkout/pay?t=<token>` posts to PayU → PayU posts back to `/api/payu/callback`
(hash + amount + `verify_payment` API check) → `/order?t=<token>`.
COD goes straight to `/order?t=<token>`. Admin sees orders at `/admin/orders` (basic auth).

**Hostinger (Business plan, Node.js web app):**
1. Back up the old WordPress site (files + DB) before switching the domain.
2. hPanel → Websites → Add website → Node.js app. Build: `pnpm install && pnpm build`, start: `pnpm start`, Node 22+.
3. Set env vars from `.env.example` in hPanel (DB host `127.0.0.1`, `PAYU_MODE=live`, `NEXT_PUBLIC_SITE_URL=https://swadeshimahadevproducts.com`, strong `ADMIN_PASSWORD`). Rebuild after changing any `NEXT_PUBLIC_*`.
4. Run `node scripts/db-setup.mjs` once (creates `orders`, `order_items`).
5. In PayU dashboard, register the live domain. Shipping is booked manually in NimbusPost for now.
