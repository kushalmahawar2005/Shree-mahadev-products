import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { AlertTriangle, ClipboardList, PackageX, Phone, RotateCcw, Truck, Undo2 } from "lucide-react";
import { CopyButton } from "@/components/admin/order/CopyButton";
import { StatTile } from "@/components/admin/ui";
import { listNdrCases } from "@/lib/server/shipments";
import { requireRole } from "@/lib/server/admin-auth";
import { createDailyManifestAction, ndrAction } from "@/lib/admin-actions";
import { cn } from "@/lib/utils/cn";

export const metadata = { title: "Shipping operations" };
export const instant = false;

const card = "rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgba(0,0,0,.04)]";
const input = "h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none placeholder:text-ink-muted/70 focus:border-forest-fg";
const btn = "inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold transition-colors";

async function manifest(formData: FormData) {
  "use server";
  let url: string | null = null;
  let problem = "";
  try {
    url = (await createDailyManifestAction(String(formData.get("date") ?? ""))).url ?? null;
  } catch (e) {
    problem = e instanceof Error ? e.message : "Could not create the manifest";
  }
  redirect(url ?? `/admin/shipping?manifest=${encodeURIComponent(problem || "NimbusPost returned no manifest link")}`);
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

export default async function ShippingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireRole("owner", "manager");
  await connection();
  const cases = await listNdrCases().catch((error) => {
    console.error("listNdrCases", error);
    return [];
  });
  const manifestNote = (await searchParams).manifest;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-forest-text sm:text-3xl">Shipping ops</h1>
        <p className="mt-1 text-sm text-ink-muted">Daily pickup manifest and failed-delivery (NDR) cases from NimbusPost.</p>
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4" aria-label="Summary">
        <StatTile icon={PackageX} label="Open NDR cases" value={String(cases.length)} note={cases.length ? "Need your action" : "All clear"} tone={cases.length ? "warn" : undefined} />
        <StatTile icon={Truck} label="Courier" value="NimbusPost" note="Bookings from each order page" />
      </section>

      <section className={cn(card, "p-4 sm:p-5")}>
        <header className="mb-4 flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-khaki-soft text-forest-fg">
            <ClipboardList className="size-4" />
          </span>
          <div>
            <h2 className="font-bold text-forest-text">Daily manifest</h2>
            <p className="text-xs text-ink-muted">One sheet for the courier listing every parcel booked that day. Opens the NimbusPost PDF.</p>
          </div>
        </header>
        <form action={manifest} className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="block sm:w-56">
            <span className="mb-1.5 block text-xs font-medium text-ink-muted">Shipment date</span>
            <input name="date" type="date" defaultValue={today} className={input} />
          </label>
          <button className={cn(btn, "h-10 justify-center bg-forest px-5 text-white hover:bg-forest-mid")}>Create manifest</button>
        </form>
        {typeof manifestNote === "string" && (
          <p role="status" className="mt-3 rounded-xl border border-warm-line bg-warm px-3 py-2 text-sm text-sale">
            {manifestNote === "Select at least one booked shipment" ? "No booked shipments on this date, so there is nothing to put on a manifest." : manifestNote.slice(0, 200)}
          </p>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-xl bg-warm-strong text-sale">
            <AlertTriangle className="size-4" />
          </span>
          <div>
            <h2 className="font-bold text-forest-text">Delivery problems (NDR)</h2>
            <p className="text-xs text-ink-muted">Courier couldn&apos;t deliver. Call the customer, then re-attempt, fix details or return.</p>
          </div>
        </div>

        {!cases.length ? (
          <p className={cn(card, "px-6 py-10 text-center text-sm text-ink-muted")}>No NDR cases reported by NimbusPost.</p>
        ) : (
          <ul className="grid gap-3 xl:grid-cols-2">
            {cases.map((c) => (
              <li key={c.awb} className={cn(card, "p-4 sm:p-5")}>
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1 font-mono text-sm font-bold text-forest-text">
                      {c.awb}
                      <CopyButton value={c.awb} label="AWB" />
                    </p>
                    <p className="text-sm font-semibold text-ink">{c.customerName ?? "Unknown customer"}</p>
                    {c.phone && (
                      <a href={`tel:+91${c.phone}`} className="inline-flex items-center gap-1 text-xs text-forest-fg hover:underline">
                        <Phone className="size-3" /> +91 {c.phone}
                      </a>
                    )}
                  </div>
                  <span className="rounded-full bg-warm-strong px-2.5 py-0.5 text-[11px] font-semibold text-sale">{c.status}</span>
                </div>
                {c.reason && <p className="mt-3 rounded-xl bg-subtle px-3 py-2 text-sm text-ink">{c.reason}</p>}

                <form action={ndr} className="mt-3">
                  <input type="hidden" name="awb" value={c.awb} />
                  <details className="group rounded-xl border border-line">
                    <summary className="flex h-10 cursor-pointer list-none items-center px-3 text-sm font-semibold text-forest-fg">
                      Change address / phone
                      <span className="ml-auto text-xs text-ink-muted group-open:hidden">Edit</span>
                    </summary>
                    <div className="space-y-2 border-t border-line p-3">
                      <input name="address" defaultValue={c.address ?? ""} placeholder="Full new address" className={input} />
                      <input name="phone" defaultValue={c.phone ?? ""} inputMode="numeric" placeholder="10-digit phone" className={input} />
                      <button name="action" value="change_address_phone" className={cn(btn, "w-full justify-center border border-line text-forest-fg hover:bg-khaki-soft")}>
                        Send new details to courier
                      </button>
                    </div>
                  </details>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button name="action" value="reattempt" className={cn(btn, "bg-forest text-white hover:bg-forest-mid")}>
                      <RotateCcw className="size-4" /> Re-attempt delivery
                    </button>
                    <button name="action" value="rto" className={cn(btn, "ml-auto border border-line text-alert hover:bg-alert-soft")}>
                      <Undo2 className="size-4" /> Return to us (RTO)
                    </button>
                  </div>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
