import { Card, Field, MockSave, PageHeader, inputCls } from "@/components/admin/ui";
import { announcements, site } from "@/data/site";

export const metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" intro="Store info, shipping and announcement bar." />
      <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        <Card title="Business">
          <div className="space-y-4">
            <Field label="Store name">
              <input className={inputCls} defaultValue={site.name} />
            </Field>
            <Field label="Phone / WhatsApp">
              <input className={inputCls} defaultValue={site.phone} />
            </Field>
            <Field label="Email" hint="TODO(client): domain email">
              <input className={inputCls} defaultValue={site.email} />
            </Field>
            <Field label="FSSAI number" hint="TODO(client)">
              <input className={inputCls} defaultValue={site.fssai} />
            </Field>
            <Field label="GST number" hint="TODO(client)">
              <input className={inputCls} defaultValue={site.gst} />
            </Field>
          </div>
        </Card>
        <div className="space-y-4">
          <Card title="Shipping">
            <div className="space-y-4">
              <Field label="Free shipping above (₹)" hint="TODO(client): old site showed both ₹999 and ₹500">
                <input className={inputCls} defaultValue={site.freeShippingThreshold} inputMode="numeric" />
              </Field>
              <label className="flex items-center gap-3">
                <input type="checkbox" defaultChecked={site.codAvailable} className="size-5 accent-[var(--color-forest)]" />
                <span className="font-semibold text-forest-text">Cash on delivery available</span>
              </label>
            </div>
          </Card>
          <Card title="Announcement bar">
            <Field label="Messages (one per line)">
              <textarea className={`${inputCls} py-3`} rows={4} defaultValue={announcements.join("\n")} />
            </Field>
          </Card>
        </div>
      </div>
      <div className="mt-6">
        <MockSave />
      </div>
    </>
  );
}
