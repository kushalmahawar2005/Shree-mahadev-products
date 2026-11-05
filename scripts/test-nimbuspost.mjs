import assert from "node:assert/strict";

process.env.NIMBUSPOST_API_KEY = "qa-mock-key";
process.env.NIMBUSPOST_API_SECRET = "qa-mock-secret";
process.env.NIMBUSPOST_WAREHOUSE_ID = "qa-warehouse";

const requests = [];
let pickupAllowed = false;
globalThis.fetch = async (url, init = {}) => {
  const path = new URL(url).pathname;
  const data = init.body ? JSON.parse(String(init.body)) : undefined;
  requests.push({ path, data });
  if (path.endsWith("/serviceability")) return Response.json({ success: true, data: { available: [{ courierId: "courier-1", courierName: "Local Mock Courier", tatDays: 3, result: { shippingChargesPaise: 1000, codChargesPaise: 250, totalPaise: 1250 } }] } });
  if (path.endsWith("/shipments")) return Response.json({ success: true, data: { order: { order_id: "mock-order" }, booking: { awb: "MOCK123", courier_id: "courier-1", courier_name: "Local Mock Courier", edd: "2026-11-08", pickup_generated: false } } });
  if (path.endsWith("/shipments/pickup")) return Response.json({ success: true, data: { courier_scheduled: pickupAllowed } });
  return Response.json({ success: false, message: "unexpected mocked endpoint" }, { status: 404 });
};

const nimbus = await import("../src/lib/server/nimbuspost.ts");
const quote = await nimbus.getCourierQuotes({ destination: "302001", weightGrams: 725, paymentType: "cod", orderAmount: 1200 });
assert.equal(requests[0].data.packages[0].weight, 725, "serviceability sends grams");
assert.equal(quote[0].total, 12.5, "provider paise convert to rupees");
assert.equal(quote[0].edd, "3–4 days", "estimated delivery derives from provider TAT");

const booked = await nimbus.createShipment({
  orderNumber: "QA-ORDER-1", paymentType: "prepaid", orderAmount: 1200, shippingCharges: 0, codCharges: 0, discount: 0,
  weightGrams: 725, dims: { length: 20, breadth: 15, height: 15 }, courierId: "courier-1",
  consignee: { name: "QA Customer", address: "Local test address", city: "Jaipur", state: "Rajasthan", pincode: "302001", phone: "9811122233" },
  items: [{ name: "QA bottle", qty: 1, price: 1200 }],
});
assert.equal(requests[1].data.package.weight, 0.725, "shipment booking converts grams to kilograms");
assert.equal(booked.awb, "MOCK123", "mock booking response maps AWB");
assert.equal(booked.pickupGenerated, false, "declined pickup state is retained");
assert.equal(await nimbus.schedulePickup("mock-order"), false, "HTTP 200 pickup decline returns false");
pickupAllowed = true;
assert.equal(await nimbus.schedulePickup("mock-order"), true, "accepted pickup returns true");

console.log("NimbusPost local mock checks passed; no provider network calls or shipment bookings were made.");
