// Runs PayU reconciliation through the app's protected cron route.
// Usage: pnpm payu:reconcile [baseUrl]   (defaults to NEXT_PUBLIC_SITE_URL)
try { process.loadEnvFile(".env.local"); } catch {}
const base = (process.argv[2] ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const res = await fetch(`${base}/api/cron/payu-reconcile`, { headers: { "x-cron-secret": process.env.CRON_SECRET ?? "" } });
console.log(res.status, await res.text());
process.exit(res.ok ? 0 : 1);
