import Image from "next/image";
import { Card, Field, MockSave, PageHeader, inputCls } from "@/components/admin/ui";
import { heroSlides } from "@/data/hero";

export const metadata = { title: "Hero banners" };

export default function BannersPage() {
  return (
    <>
      <PageHeader title="Hero banners" intro="Homepage slider. Desktop image 1600 × 650. Optional mobile image 800 × 800." />
      <div className="space-y-4">
        {heroSlides.map((s, i) => (
          <Card key={s.src} title={`Slide ${i + 1}`}>
            <div className="grid gap-4 md:grid-cols-[320px_minmax(0,1fr)]">
              <Image src={s.src} alt={s.alt} width={1600} height={650} unoptimized className="w-full rounded-xl" />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Image path">
                  <input className={inputCls} defaultValue={s.src} />
                </Field>
                <Field label="Mobile image (optional)">
                  <input className={inputCls} defaultValue={s.mobileSrc ?? ""} placeholder="Same as desktop" />
                </Field>
                <Field label="Link">
                  <input className={inputCls} defaultValue={s.href} />
                </Field>
                <Field label="Alt text">
                  <input className={inputCls} defaultValue={s.alt} />
                </Field>
              </div>
            </div>
          </Card>
        ))}
      </div>
      <div className="mt-6">
        <MockSave />
      </div>
    </>
  );
}
