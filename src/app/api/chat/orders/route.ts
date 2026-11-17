import type { RowDataPacket } from "mysql2/promise";
import { NextResponse, type NextRequest } from "next/server";
import { cancelRule } from "@/components/account/help/help-lib";
import { getAccountOrder, listAccountOrders } from "@/lib/server/account";
import { getCustomerSession } from "@/lib/server/customer-auth";
import { getGuestChatOrderPhone } from "@/lib/server/chat-orders";
import { db } from "@/lib/server/db";
import { hasActiveShipment } from "@/lib/server/orders";
import { lookupTrackingByCredentials } from "@/lib/server/tracking";
import { loadChatCatalog } from "@/lib/server/chat-knowledge";

export async function GET(request: NextRequest) {
  const customer = await getCustomerSession();
  const idRaw = request.nextUrl.searchParams.get("orderId");
  const id = idRaw && /^\d+$/.test(idRaw) ? Number(idRaw) : null;
  const guestPhone = customer ? null : await getGuestChatOrderPhone();
  try {
    if (id) {
      if (customer) {
        const order = await getAccountOrder(customer.id, id);
        if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
        return NextResponse.json({
          order: {
            id: order.id, orderNo: order.orderNo, status: order.status, createdAt: order.createdAt,
            method: order.method, eta: order.eta, courier: order.courier, awb: order.awb,
            tracking: {
              status: order.status,
              expectedDelivery: order.eta,
              courier: order.courier,
              awb: order.awb,
              trackingUrl: order.trackingUrl,
              events: order.tracking.map((event) => ({ status: event.status, label: event.status.replaceAll("_", " "), at: event.at, location: event.location })),
            },
            refunds: order.refunds,
            cancelReason: order.status === "cancelled" ? order.events.find((event) => event.to === "cancelled")?.note ?? null : null,
            canCancel: cancelRule(order.status, order.method, await hasActiveShipment(order.id)),
            returnDaysLeft: order.returnDaysLeft,
            returnRequested: Boolean(order.returnRequest),
            items: order.items.map((item) => ({ variantKey: item.variantKey, title: item.title, variant: item.variant, qty: item.qty })),
          },
        });
      }
      if (!guestPhone) return NextResponse.json({ error: "Verify your phone to view this order." }, { status: 401 });
      const [[row]] = await db().query<RowDataPacket[]>("SELECT order_no, status, created_at, payment_method FROM orders WHERE id=? AND phone=? LIMIT 1", [id, guestPhone]);
      if (!row) return NextResponse.json({ error: "Order not found." }, { status: 404 });
      const tracking = await lookupTrackingByCredentials(String(row.order_no), guestPhone);
      const [refundRows] = await db().query<RowDataPacket[]>("SELECT amount, status, created_at AS at FROM refunds WHERE order_id=? ORDER BY id DESC", [id]);
      return NextResponse.json({
        order: {
          id, orderNo: String(row.order_no), status: String(row.status), createdAt: String(row.created_at),
          method: String(row.payment_method), tracking: tracking.tracking,
          refunds: refundRows.map((r) => ({ amount: Number(r.amount), status: String(r.status), at: String(r.at) })),
          cancelRule: cancelRule(String(row.status), String(row.payment_method), await hasActiveShipment(id)),
          guest: true,
        },
      });
    }

    if (customer) {
      // Page size 10; "Aur dikhayein" asks for the next page. Ownership: session-scoped query.
      const pageRaw = Number(request.nextUrl.searchParams.get("page") ?? "1");
      const page = Number.isInteger(pageRaw) && pageRaw > 0 && pageRaw <= 20 ? pageRaw : 1;
      const [orders, catalog] = await Promise.all([listAccountOrders(customer.id, page * 10 + 1), loadChatCatalog()]);
      const images = new Map(catalog.map((product) => [product.handle, product.images[0]?.url ?? null]));
      return NextResponse.json({
        authenticated: true,
        hasMore: orders.length > page * 10,
        orders: orders.slice(0, page * 10).map((o) => ({
          id: o.id, orderNo: o.orderNo, status: o.status, createdAt: o.createdAt, eta: o.eta,
          total: o.total, method: o.method,
          itemCount: o.items.reduce((sum, item) => sum + item.qty, 0),
          firstItem: o.items[0] ? { title: o.items[0].title, variant: o.items[0].variant, image: images.get(o.items[0].handle) ?? null } : null,
        })),
      });
    }

    if (!guestPhone) return NextResponse.json({ authenticated: false, orders: [] });
    const [orders] = await db().query<RowDataPacket[]>(
      "SELECT id, order_no, status, created_at FROM orders WHERE phone=? ORDER BY id DESC LIMIT 15",
      [guestPhone],
    );
    return NextResponse.json({
      authenticated: false,
      orders: orders.map((o) => ({ id: Number(o.id), orderNo: String(o.order_no), status: String(o.status), createdAt: String(o.created_at) })),
    });
  } catch (error) {
    console.error("chat orders", error);
    return NextResponse.json({ error: "Couldn't load your order details right now." }, { status: 500 });
  }
}
