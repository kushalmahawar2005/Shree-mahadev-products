// Applies pending SQL migrations from sql/migrations in filename order.
// Local: `pnpm db:setup` (reads .env.local). Hostinger: `node scripts/db-setup.mjs` with env vars set.
import { readdirSync, readFileSync } from "node:fs";
import mysql from "mysql2/promise";

try {
  process.loadEnvFile(".env.local");
} catch {
  // no .env.local: use real environment variables
}

const dir = new URL("../sql/migrations/", import.meta.url);
const conn = await mysql.createConnection({
  host: process.env.DATABASE_HOST,
  port: Number(process.env.DATABASE_PORT ?? 3306),
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  multipleStatements: true,
});

await conn.query(
  "CREATE TABLE IF NOT EXISTS schema_migrations (name VARCHAR(120) PRIMARY KEY, applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)",
);
const [done] = await conn.query("SELECT name FROM schema_migrations");
const applied = new Set(done.map((r) => r.name));

for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
  if (applied.has(file)) continue;
  process.stdout.write(`Applying ${file}… `);
  // MySQL DDL auto-commits, so a failed migration must be fixed by hand. Keep migrations small.
  await conn.query(readFileSync(new URL(file, dir), "utf8"));
  await conn.query("INSERT INTO schema_migrations (name) VALUES (?)", [file]);
  console.log("done");
}

const [tables] = await conn.query("SHOW TABLES");
console.log("Tables:", tables.map((r) => Object.values(r)[0]).join(", "));
await conn.end();
