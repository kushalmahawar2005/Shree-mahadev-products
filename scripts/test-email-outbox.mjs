import { randomBytes } from "node:crypto";
import { connectQaDatabase } from "./test-db.mjs";

process.loadEnvFile(".env.local");
const BASE = process.argv[2] ?? "http://127.0.0.1:3005";
if (!new URL(BASE).hostname.match(/^(localhost|127\.0\.0\.1|\[::1\])$/)) throw new Error("Email outbox tests require a localhost app URL");
if (!process.env.CRON_SECRET) throw new Error("QA CRON_SECRET is required");
const provider = await fetch("http://127.0.0.1:3010/health").catch(() => null);
if (!provider?.ok) throw new Error("Start the local QA provider mock on port 3010 first");
if (!process.env.RESEND_API_KEY || !process.env.RESEND_API_URL?.startsWith("http://127.0.0.1:3010/")) {
  throw new Error("This test requires the QA-only fake Resend token and local mock endpoint");
}

const db = await connectQaDatabase();
const tag = randomBytes(5).toString("hex");
const ids = [];
let okay = true;
const check = (condition, label) => { console.log(`${condition ? "PASS" : "FAIL"}  ${label}`); if (!condition) okay = false; };
const cron = async () => {
  const response = await fetch(`${BASE}/api/cron/email-outbox`, { headers: { "x-cron-secret": process.env.CRON_SECRET } });
  return { response, body: await response.json() };
};
const states = async () => {
  const [rows] = await db.query("SELECT id, status, attempts, error FROM email_outbox WHERE id IN (?) ORDER BY id", [ids]);
  return rows;
};
const makeDue = async () => db.query("UPDATE email_outbox SET next_attempt_at=NOW() WHERE id IN (?)", [ids]);

try {
  const unauthorized = await fetch(`${BASE}/api/cron/email-outbox`);
  check(unauthorized.status === 401, "cron rejects requests without x-cron-secret");
  for (const [email, key] of [[`retry-${tag}@example.test`, `qa-retry:${tag}`], ["permanent-failure@example.test", `qa-final:${tag}`]]) {
    const [r] = await db.execute(
      "INSERT INTO email_outbox (order_id,template,to_email,subject,html,text_body,dedupe_key) VALUES (NULL,'store_new_inquiry',?,?,?, ?,?)",
      [email, `QA outbox ${tag}`, "<p>Local QA message</p>", "Local QA message", key],
    );
    ids.push(Number(r.insertId));
  }

  const first = await cron();
  check(first.response.status === 200 && first.body.ok === true && typeof first.body.sent === "number" && typeof first.body.failed === "number" && typeof first.body.waiting === "number", "authorized worker returns sent, failed and waiting counts");
  let rows = await states();
  check(rows[0]?.status === "pending" && Number(rows[0]?.attempts) === 1, "transient provider error stays pending with retry count incremented");
  check(rows[1]?.status === "pending" && Number(rows[1]?.attempts) === 1, "repeated provider error is queued for retry");

  await makeDue();
  await cron();
  rows = await states();
  check(rows[0]?.status === "sent" && Number(rows[0]?.attempts) === 2, "transient provider error succeeds on retry");
  check(rows[1]?.status === "pending" && Number(rows[1]?.attempts) === 2, "provider error remains retryable before the attempt limit");

  for (let attempt = 3; attempt <= 5; attempt++) {
    await makeDue();
    await cron();
  }
  rows = await states();
  check(rows[1]?.status === "failed" && Number(rows[1]?.attempts) === 5, "message moves to failed after the configured five attempts");
} catch (error) {
  console.error(error);
  okay = false;
} finally {
  try {
    if (ids.length) await db.query("DELETE FROM email_outbox WHERE id IN (?)", [ids]);
    await db.end();
  } catch (error) { console.error("Email outbox cleanup failed", error); okay = false; }
}

console.log(okay ? "\nALL PASSED" : "\nSOME CHECKS FAILED");
process.exitCode = okay ? 0 : 1;
