import { createServer } from "node:http";

const host = "127.0.0.1";
const port = Number(process.env.QA_MOCK_PORT ?? 3010);
const payuStatuses = new Map();
const mailAttempts = new Map();

function send(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
}

async function body(req) {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  try { return JSON.parse(raw); } catch { return Object.fromEntries(new URLSearchParams(raw)); }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${host}:${port}`);
  if (req.method === "GET" && url.pathname === "/health") return send(res, 200, { ok: true });

  if (req.method === "POST" && url.pathname === "/__qa/payu") {
    const data = await body(req);
    if (typeof data.txnid !== "string" || !["success", "failure", "pending", "Not Found"].includes(data.status)) return send(res, 400, { ok: false });
    payuStatuses.set(data.txnid, { status: data.status, amount: Number(data.amount ?? 0), mihpayid: String(data.mihpayid ?? "QA-MOCK") });
    return send(res, 200, { ok: true });
  }

  if (req.method === "POST" && url.pathname === "/payu/verify") {
    const form = await body(req);
    const txnid = String(form.var1 ?? "");
    const result = payuStatuses.get(txnid);
    if (!result) return send(res, 200, { transaction_details: {} });
    return send(res, 200, { transaction_details: { [txnid]: { status: result.status, amt: Number(result.amount).toFixed(2), mihpayid: result.mihpayid } } });
  }

  if (req.method === "POST" && url.pathname === "/emails") {
    const payload = await body(req);
    const recipient = Array.isArray(payload.to) ? String(payload.to[0] ?? "") : "";
    const idempotency = String(req.headers["idempotency-key"] ?? "missing");
    const attempt = (mailAttempts.get(idempotency) ?? 0) + 1;
    mailAttempts.set(idempotency, attempt);
    if (recipient === "permanent-failure@example.test" || (recipient.startsWith("retry-") && attempt === 1)) {
      return send(res, 503, { name: "mock_error", message: "Intentional local QA provider failure" });
    }
    return send(res, 200, { id: `mock_${idempotency}` });
  }

  return send(res, 404, { ok: false });
});

server.listen(port, host, () => console.log(`Local QA provider mocks listening on http://${host}:${port}`));
