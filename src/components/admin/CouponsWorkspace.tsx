"use client";

import { useState, useTransition } from "react";
import { saveCouponAction } from "@/lib/coupon-actions";
import { formatMoney } from "@/lib/utils/money";
import { Card, StatusBadge, inputCls } from "@/components/admin/ui";

type Target = { kind: "product" | "collection"; handle: string };
type Coupon = {
  id: number;
  code: string;
  kind: "percent" | "flat" | "free_shipping";
  value: number;
  minSubtotal: number;
  maxDiscount: number | null;
  firstOrderOnly: boolean;
  usageLimit: number | null;
  perPhoneLimit: number | null;
  usedCount: number;
  redeemed: number;
  revenue: number;
  startsAt: string;
  endsAt: string;
  active: boolean;
  targets: Target[];
};
type Choice = { handle: string; title: string };

const empty = {
  id: null as number | null,
  code: "",
  kind: "percent" as Coupon["kind"],
  value: 10,
  minSubtotal: 0,
  maxDiscount: null as number | null,
  firstOrderOnly: false,
  usageLimit: null as number | null,
  perPhoneLimit: null as number | null,
  startsAt: "",
  endsAt: "",
  active: true,
  targets: [] as Target[],
};

export function CouponsWorkspace({
  coupons,
  products,
  collections,
}: {
  coupons: Coupon[];
  products: Choice[];
  collections: Choice[];
}) {
  const [form, setForm] = useState(empty);
  const [notice, setNotice] = useState("");
  const [pending, startTransition] = useTransition();
  const targetKey = (t: Target) => `${t.kind}:${t.handle}`;
  const selected = new Set(form.targets.map(targetKey));
  const percentWarning = form.kind === "percent" && form.value > 25;

  function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");
    startTransition(async () => {
      const result = await saveCouponAction({
        ...form,
        value: form.kind === "free_shipping" ? 0 : Number(form.value),
      });
      if (!result.ok) {
        setNotice(result.error ?? "Could not save coupon.");
        return;
      }
      setNotice("Coupon saved.");
      location.reload();
    });
  }

  function edit(coupon: Coupon) {
    setForm({
      id: coupon.id,
      code: coupon.code,
      kind: coupon.kind,
      value: coupon.value,
      minSubtotal: coupon.minSubtotal,
      maxDiscount: coupon.maxDiscount,
      firstOrderOnly: coupon.firstOrderOnly,
      usageLimit: coupon.usageLimit,
      perPhoneLimit: coupon.perPhoneLimit,
      startsAt: coupon.startsAt,
      endsAt: coupon.endsAt,
      active: coupon.active,
      targets: coupon.targets,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function toggleTarget(target: Target, checked: boolean) {
    setForm((current) => ({
      ...current,
      targets: checked
        ? [...current.targets, target]
        : current.targets.filter(
            (item) => targetKey(item) !== targetKey(target),
          ),
    }));
  }

  return (
    <div className="space-y-5">
      <Card title={form.id ? `Edit ${form.code}` : "Create coupon"}>
        <form
          onSubmit={save}
          className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
        >
          <label>
            <span className="mb-1 block text-sm font-semibold">
              Coupon code
            </span>
            <input
              required
              maxLength={30}
              value={form.code}
              onChange={(e) =>
                setForm({ ...form, code: e.target.value.toUpperCase() })
              }
              placeholder="WELCOME10"
              className={inputCls}
            />
          </label>
          <label>
            <span className="mb-1 block text-sm font-semibold">Offer type</span>
            <select
              value={form.kind}
              onChange={(e) =>
                setForm({
                  ...form,
                  kind: e.target.value as Coupon["kind"],
                  value: e.target.value === "free_shipping" ? 0 : form.value,
                })
              }
              className={inputCls}
            >
              <option value="percent">Percentage</option>
              <option value="flat">Fixed amount</option>
              <option value="free_shipping">Free shipping</option>
            </select>
          </label>
          {form.kind !== "free_shipping" && (
            <label>
              <span className="mb-1 block text-sm font-semibold">
                {form.kind === "percent" ? "Percent off" : "Amount off (₹)"}
              </span>
              <input
                type="number"
                min={1}
                max={form.kind === "percent" ? 100 : 100000}
                value={form.value}
                onChange={(e) =>
                  setForm({ ...form, value: Number(e.target.value) })
                }
                className={inputCls}
              />
            </label>
          )}
          <label>
            <span className="mb-1 block text-sm font-semibold">
              Minimum order (₹)
            </span>
            <input
              type="number"
              min={0}
              value={form.minSubtotal}
              onChange={(e) =>
                setForm({ ...form, minSubtotal: Number(e.target.value) })
              }
              className={inputCls}
            />
          </label>
          {form.kind === "percent" && (
            <label>
              <span className="mb-1 block text-sm font-semibold">
                Maximum discount (₹, optional)
              </span>
              <input
                type="number"
                min={1}
                value={form.maxDiscount ?? ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    maxDiscount: e.target.value ? Number(e.target.value) : null,
                  })
                }
                className={inputCls}
              />
            </label>
          )}
          <label>
            <span className="mb-1 block text-sm font-semibold">
              Total uses (optional)
            </span>
            <input
              type="number"
              min={1}
              value={form.usageLimit ?? ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  usageLimit: e.target.value ? Number(e.target.value) : null,
                })
              }
              className={inputCls}
            />
          </label>
          <label>
            <span className="mb-1 block text-sm font-semibold">
              Uses per phone (optional)
            </span>
            <input
              type="number"
              min={1}
              value={form.perPhoneLimit ?? ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  perPhoneLimit: e.target.value ? Number(e.target.value) : null,
                })
              }
              className={inputCls}
            />
          </label>
          <label className="flex min-h-12 items-center gap-3 rounded-xl border border-line px-4">
            <input
              type="checkbox"
              checked={form.firstOrderOnly}
              onChange={(e) =>
                setForm({ ...form, firstOrderOnly: e.target.checked })
              }
              className="size-5 accent-forest"
            />
            First order only
          </label>
          <label>
            <span className="mb-1 block text-sm font-semibold">
              Starts (optional)
            </span>
            <input
              type="datetime-local"
              value={form.startsAt}
              onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
              className={inputCls}
            />
          </label>
          <label>
            <span className="mb-1 block text-sm font-semibold">
              Ends (optional)
            </span>
            <input
              type="datetime-local"
              value={form.endsAt}
              onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
              className={inputCls}
            />
          </label>
          <label className="flex min-h-12 items-center gap-3 rounded-xl border border-line px-4">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
              className="size-5 accent-forest"
            />
            Active
          </label>
          <fieldset className="rounded-2xl border border-line p-4 md:col-span-2 xl:col-span-3">
            <legend className="px-1 font-semibold">Applies to</legend>
            <p className="mb-3 text-sm text-ink-muted">
              Leave all unchecked to apply to the whole order.
            </p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((p) => {
                const t = { kind: "product" as const, handle: p.handle };
                return (
                  <label
                    key={targetKey(t)}
                    className="flex items-center gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(targetKey(t))}
                      onChange={(e) => toggleTarget(t, e.target.checked)}
                      className="size-4 accent-forest"
                    />
                    {p.title}
                  </label>
                );
              })}
              {collections.map((c) => {
                const t = { kind: "collection" as const, handle: c.handle };
                return (
                  <label
                    key={targetKey(t)}
                    className="flex items-center gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(targetKey(t))}
                      onChange={(e) => toggleTarget(t, e.target.checked)}
                      className="size-4 accent-forest"
                    />
                    Collection: {c.title}
                  </label>
                );
              })}
            </div>
          </fieldset>
          {percentWarning && (
            <p className="rounded-xl bg-khaki-soft p-3 text-sm text-sale md:col-span-2 xl:col-span-3">
              This offer is above 25% off. Please confirm the margin before
              activating it.
            </p>
          )}
          {notice && (
            <p
              aria-live="polite"
              className="text-sm text-sale md:col-span-2 xl:col-span-3"
            >
              {notice}
            </p>
          )}
          <div className="flex gap-2 md:col-span-2 xl:col-span-3">
            <button
              disabled={pending}
              className="min-h-12 rounded-full bg-forest px-6 font-semibold text-white disabled:opacity-50"
            >
              {pending ? "Saving…" : form.id ? "Save coupon" : "Create coupon"}
            </button>
            {form.id && (
              <button
                type="button"
                onClick={() => {
                  setForm(empty);
                  setNotice("");
                }}
                className="min-h-12 rounded-full border border-line px-6 font-semibold"
              >
                New coupon
              </button>
            )}
          </div>
        </form>
      </Card>

      <section className="space-y-3" aria-label="Existing coupons">
        {coupons.length ? (
          coupons.map((coupon) => (
            <Card key={coupon.id}>
              <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-bold text-forest-text">
                      {coupon.code}
                    </h2>
                    <StatusBadge tone={coupon.active ? "green" : "gray"}>
                      {coupon.active ? "Active" : "Paused"}
                    </StatusBadge>
                    <StatusBadge tone="gray">
                      {coupon.kind === "percent"
                        ? `${coupon.value}% off`
                        : coupon.kind === "flat"
                          ? `${formatMoney(coupon.value)} off`
                          : "Free shipping"}
                    </StatusBadge>
                  </div>
                  <p className="mt-1 text-sm text-ink-muted">
                    Minimum {formatMoney(coupon.minSubtotal)} ·{" "}
                    {coupon.firstOrderOnly
                      ? "First order only"
                      : "All customers"}
                    {coupon.targets.length
                      ? ` · ${coupon.targets.length} selected targets`
                      : " · All products"}
                  </p>
                  <p className="mt-1 text-sm text-ink-muted">
                    Used {coupon.usedCount}
                    {coupon.usageLimit ? ` / ${coupon.usageLimit}` : ""} ·{" "}
                    {formatMoney(coupon.revenue)} order revenue
                  </p>
                </div>
                <button
                  onClick={() => edit(coupon)}
                  className="min-h-11 rounded-full border border-line px-5 font-semibold"
                >
                  Edit
                </button>
              </div>
            </Card>
          ))
        ) : (
          <Card>
            <p className="text-ink-muted">
              No coupons yet. Create your first code above.
            </p>
          </Card>
        )}
      </section>
    </div>
  );
}
