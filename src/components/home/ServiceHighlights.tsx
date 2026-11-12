import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import { Headset, Plant, ShieldCheck, Truck } from "@phosphor-icons/react/dist/ssr";
import { Stagger, StaggerItem } from "@/components/motion/Reveal";

type Highlight = { icon: PhosphorIcon; title: string; text: React.ReactNode };

/**
 * Four store promises (shipping, purity, payment, support) shown just above the footer, as one
 * white card split into cells by hairlines (gap-px over a line-coloured background), so it reads
 * clearly against the cream page. 2x2 on phones, 4 across on desktop.
 */
export function ServiceHighlights({ phone }: { phone: string }) {
  const tel = `tel:${phone.replace(/[^\d+]/g, "")}`;
  const items: Highlight[] = [
    { icon: Truck, title: "Fast shipping", text: "Delivered to your door, anywhere in India." },
    { icon: Plant, title: "Pure & natural", text: "Nothing added, nothing taken out." },
    { icon: ShieldCheck, title: "Secure payment", text: "UPI, cards and netbanking via PayU." },
    {
      icon: Headset,
      title: "Real people, real help",
      text: (
        <>
          9am–6pm at{" "}
          <a href={tel} className="font-semibold whitespace-nowrap text-forest-text underline-offset-2 hover:underline">
            {phone}
          </a>
        </>
      ),
    },
  ];

  return (
    <section aria-label="Why shop with us" className="bg-page pt-2 pb-2 md:pb-14">
      <div className="mx-auto max-w-[1360px] px-4 md:px-8">
        <Stagger variant="linear" className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border md:rounded-3xl border-line bg-line shadow-[0_1px_2px_rgba(0,0,0,.04)] lg:grid-cols-4">
          {items.map(({ icon: Icon, title, text }) => (
            <StaggerItem
              key={title}
              className="flex flex-col items-center gap-1.5 bg-white px-3 py-3.5 text-center sm:flex-row sm:items-start sm:gap-3.5 sm:p-5 sm:text-left lg:p-6"
            >
              {/* Phosphor duotone: forest outline, the tinted inner layer recoloured mustard. No tile behind it. */}
              <Icon
                weight="duotone"
                aria-hidden
                className="size-7 shrink-0 text-forest md:size-11 [&_path[opacity]]:fill-[#E0A526] [&_path[opacity]]:opacity-45"
              />
              <div className="min-w-0">
                <h3 className="text-[13px] font-bold text-forest-text md:text-base">{title}</h3>
                <p className="mt-0.5 text-[11.5px] leading-snug text-ink-muted md:mt-1 md:text-sm md:leading-relaxed">{text}</p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
