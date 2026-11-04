import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { PageHeader, Card, StatusBadge } from "@/components/admin/ui";
import { listNdrCases } from "@/lib/server/shipments";
import { requireRole } from "@/lib/server/admin-auth";
import { createDailyManifestAction, ndrAction } from "@/lib/admin-actions";

export const metadata = { title: "Shipping operations" };
export const instant = false;

async function manifest(formData: FormData) {
  "use server";
  const result = await createDailyManifestAction(String(formData.get("date") ?? ""));
  if (result.url) redirect(result.url);
}

async function ndr(formData: FormData) {
  "use server";
  await ndrAction(
    String(formData.get("awb") ?? ""),
    String(formData.get("action") ?? "") as "reattempt" | "change_address_phone" | "rto",
    { address: String(formData.get("address") ?? ""), phone: String(formData.get("phone") ?? "") },
  );
  revalidatePath("/admin/shipping");
}

export default async function ShippingPage() {
  await requireRole("owner", "manager");
  await connection();
  const cases = await listNdrCases().catch((error) => {
    console.error("listNdrCases", error);
    return [];
  });
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
  return (
    <>
      <PageHeader title="Shipping operations" intro="Create the daily manifest and resolve NimbusPost NDR cases." />
      <Card title="Daily manifest">
        <form action={manifest} className="flex flex-wrap items-end gap-3">
          <label className="text-sm"><span className="mb-1 block font-semibold">Shipment date</span><input name="date" type="date" defaultValue={today} className="min-h-11 rounded-xl border border-line px-3" /></label>
          <button className="min-h-11 rounded-full bg-forest px-5 font-semibold text-white">Create manifest</button>
        </form>
        <p className="mt-3 text-sm text-ink-muted">The NimbusPost response opens through its returned manifest URL when available.</p>
      </Card>
      <Card title={`NDR cases (${cases.length})`} className="mt-6">
        {!cases.length ? <p className="text-sm text-ink-muted">No NDR cases reported by NimbusPost.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead><tr className="border-b border-line text-ink-muted"><th className="py-2">AWB</th><th>Customer</th><th>Reason</th><th>Status</th><th>Actions</th></tr></thead><tbody>{cases.map((item) => <tr key={item.awb} className="border-b border-line"><td className="py-3 font-semibold">{item.awb}</td><td>{item.customerName ?? "—"}<span className="block text-ink-muted">{item.phone ?? ""}</span></td><td>{item.reason ?? "—"}</td><td><StatusBadge tone="amber">{item.status}</StatusBadge></td><td><form action={ndr} className="flex flex-wrap items-center gap-2"><input type="hidden" name="awb" value={item.awb} /><button name="action" value="reattempt" className="rounded-full border border-line px-3 py-2 font-semibold hover:border-forest">Re-attempt</button><button name="action" value="rto" className="rounded-full border border-red-200 px-3 py-2 font-semibold text-red-700 hover:bg-red-50">RTO</button><input name="address" defaultValue={item.address ?? ""} placeholder="New address" className="min-h-10 w-44 rounded-xl border border-line px-2" /><input name="phone" defaultValue={item.phone ?? ""} placeholder="10-digit phone" className="min-h-10 w-32 rounded-xl border border-line px-2" /><button name="action" value="change_address_phone" className="rounded-full border border-line px-3 py-2 font-semibold hover:border-forest">Update details</button></form></td></tr>)}</tbody></table></div>}
      </Card>
    </>
  );
}
