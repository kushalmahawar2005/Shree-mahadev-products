// Track order privacy, phone lookup, event timeline, and email-token link.
// Usage: TEST_MANIFEST_DIR=.next/dev pnpm test:tracking http://127.0.0.1:3000
import { randomBytes } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { connectQaDatabase } from "./test-db.mjs";

process.loadEnvFile(".env.local");
const BASE = process.argv[2] ?? "http://localhost:3000";
const db = await connectQaDatabase();
const suffix = randomBytes(3).toString("hex").toUpperCase();
const token = randomBytes(16).toString("hex");
const orderNo = `SMP16${suffix}`;
let orderId;
let shipmentId;
let pass = true;
const check = (ok, text) => { console.log(`${ok ? "PASS" : "FAIL"}  ${text}`); if (!ok) pass = false; };
const walk = (dir) => readdirSync(dir).flatMap((file) => statSync(join(dir, file)).isDirectory() ? walk(join(dir, file)) : [join(dir, file)]);
function actionId(name) {
  const manifestDir = process.env.TEST_MANIFEST_DIR ?? ".next/dev";
  for (const path of walk(manifestDir).filter((file) => file.endsWith("server-reference-manifest.json"))) {
    const manifest = JSON.parse(readFileSync(path, "utf8"));
    for (const [id, action] of Object.entries(manifest.node ?? {})) if (action.exportedName === name) return id;
  }
  throw new Error(`Server action ${name} is missing; open /track-order in dev once first`);
}

try {
  const [insert] = await db.execute(
    `INSERT INTO orders (order_no,token,status,payment_method,customer_name,phone,email,address_line1,address_line2,city,state,pincode,subtotal,discount,shipping,cod_fee,total)
     VALUES (?,?,'shipped','cod','Tracking Test Customer','9412345678','tracking-test@example.test','123 Secret Lane','Flat 8','Jaipur','Rajasthan','302001',1000,0,0,0,1000)`,
    [orderNo, token],
  );
  orderId = Number(insert.insertId);
  await db.execute("INSERT INTO order_events (order_id,from_status,to_status,actor,note,created_at) VALUES (?,NULL,'cod_pending','system','private note must not be displayed',NOW() - INTERVAL 2 DAY)", [orderId]);
  await db.execute("INSERT INTO order_events (order_id,from_status,to_status,actor,note,created_at) VALUES (?,'cod_pending','shipped','admin','private courier details',NOW() - INTERVAL 1 DAY)", [orderId]);
  const [shipment] = await db.execute(
    `INSERT INTO shipments (order_id,awb,courier,status,estimated_delivery,tracking_url) VALUES (?,?,'Test Courier','in_transit',DATE_ADD(CURDATE(),INTERVAL 3 DAY),'https://courier.example.test/track')`,
    [orderId, `TEST${suffix}`],
  );
  shipmentId = Number(shipment.insertId);
  await db.execute("INSERT INTO shipment_events (shipment_id,status,location,message,event_at) VALUES (?,'Picked up','Jaipur','Test scan',NOW() - INTERVAL 1 DAY)", [shipmentId]);
  await db.execute("INSERT INTO shipment_events (shipment_id,status,location,message,event_at) VALUES (?,'In transit','Ajmer','Test scan',NOW())", [shipmentId]);

  const tokenPage = await fetch(`${BASE}/track-order?t=${token}`);
  const html = await tokenPage.text();
  check(tokenPage.status === 200 && html.includes(orderNo) && html.includes("In transit"), "secure email token opens the order status timeline");
  check(html.includes("Jaipur") && html.includes("Rajasthan") && html.includes("••••01") && !html.includes("123 Secret Lane") && !html.includes("9412345678"), "tracking page masks address and hides phone number");
  check(html.includes(`TEST${suffix}`) && html.includes("Test Courier") && html.includes("courier.example.test") && html.includes("Not shared by courier yet") === false, "courier, AWB, tracking link, and carrier estimate are shown");
  check(html.includes("private note must not be displayed") === false && html.includes("private courier details") === false, "internal order notes stay private");

  const id = actionId("lookupTrackingAction");
  const action = async (phone) => fetch(BASE + "/track-order", {
    method: "POST",
    headers: { "Next-Action": id, "Content-Type": "text/plain;charset=UTF-8", "X-Forwarded-For": "198.51.100.221" },
    body: JSON.stringify([{ orderNo, phone }]),
    redirect: "manual",
  });
  const valid = await action("+91 94123 45678");
  const validBody = await valid.text();
  check(valid.status === 200 && validBody.includes(orderNo) && validBody.includes("Test Courier"), "order number + phone lookup returns matching tracking details");
  const invalid = await action("9412340000");
  const invalidBody = await invalid.text();
  check(invalid.status === 200 && invalidBody.includes("couldn't find an order") && !invalidBody.includes(orderNo) && !invalidBody.includes("123 Secret Lane"), "wrong phone gets a generic response without order data");
  for (let attempt = 0; attempt < 18; attempt++) await (await action("9412340000")).text();
  const limited = await action("9412340000");
  check((await limited.text()).includes("Too many lookup attempts"), "lookup is rate limited after 20 attempts in 10 minutes");
} catch (error) {
  console.error(error); pass = false;
} finally {
  try {
    if (shipmentId) await db.execute("DELETE FROM shipments WHERE id=?", [shipmentId]);
    if (orderId) await db.execute("DELETE FROM orders WHERE id=?", [orderId]);
    await db.execute("DELETE FROM rate_limits WHERE bucket='track:198.51.100.221'");
    await db.end();
  } catch (error) { console.error("Tracking test cleanup failed", error); pass = false; }
}
console.log(pass ? "\nALL PASSED" : "\nSOME CHECKS FAILED");
process.exitCode = pass ? 0 : 1;
