// Confirm that the worker leaves queued mail alone when Resend is not configured.
import { randomBytes } from "node:crypto";
import { connectQaDatabase } from "./test-db.mjs";

process.loadEnvFile(".env.local");
const BASE = process.argv[2] ?? "http://127.0.0.1:3005";
if (!new URL(BASE).hostname.match(/^(localhost|127\.0\.0\.1|\[::1\])$/)) throw new Error("Email outbox tests require a localhost app URL");
if (process.env.RESEND_API_KEY) throw new Error("Restart the QA server after removing RESEND_API_KEY before this check");
if (!process.env.CRON_SECRET) throw new Error("QA CRON_SECRET is required");
const db = await connectQaDatabase();
const key = `qa-no-key:${randomBytes(5).toString("hex")}`;
let id;
let okay = true;
const check = (condition, label) => { console.log(`${condition ? "PASS" : "FAIL"}  ${label}`); if (!condition) okay = false; };

try {
  const [created] = await db.execute(
    "INSERT INTO email_outbox (order_id,template,to_email,subject,html,text_body,dedupe_key) VALUES (NULL,'store_new_inquiry','queued@example.test','QA waiting check','<p>Queued</p>','Queued',?)",
    [key],
  );
  id = Number(created.insertId);
  const response = await fetch(`${BASE}/api/cron/email-outbox`, { headers: { "x-cron-secret": process.env.CRON_SECRET } });
  const body = await response.json();
  const [[row]] = await db.query("SELECT status,attempts,error FROM email_outbox WHERE id=?", [id]);
  check(response.status === 200 && body.ok === true && body.waiting >= 1, "worker reports queued messages as waiting without a provider key");
  check(row.status === "pending" && Number(row.attempts) === 0 && String(row.error).includes("RESEND_API_KEY not set"), "message stays pending without a send attempt when Resend is unconfigured");
} catch (error) {
  console.error(error);
  okay = false;
} finally {
  try {
    if (id) await db.execute("DELETE FROM email_outbox WHERE id=?", [id]);
    await db.end();
  } catch (error) { console.error("Email no-key cleanup failed", error); okay = false; }
}

console.log(okay ? "\nALL PASSED" : "\nSOME CHECKS FAILED");
process.exitCode = okay ? 0 : 1;
