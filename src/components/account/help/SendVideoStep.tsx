import { Video } from "lucide-react";
import { WhatsApp } from "@/components/icons/duo";
import { cn } from "@/lib/utils/cn";
import { unboxingVideoLink } from "./help-lib";

/**
 * Last step of a damage / expiry claim: send the unboxing video on WhatsApp (videos are not uploaded
 * to the site). The chat opens with the order number and request id filled in, so the team can match it.
 */
export function SendVideoStep({ orderNo, refNo, className }: { orderNo: string | null; refNo?: string | null; className?: string }) {
  return (
    <div className={cn("rounded-2xl border border-[#25D366]/40 bg-[#25D366]/[0.06] p-4 text-left", className)}>
      <p className="flex items-center gap-2 text-sm font-bold text-ink">
        <Video className="size-4 text-forest" /> Next: send your unboxing video on WhatsApp
      </p>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-[13px] leading-relaxed text-ink-muted">
        <li>Tap the button below. WhatsApp opens with your order number already written.</li>
        <li>Attach the full unboxing video (one continuous video, from the sealed parcel to the damage or expiry date).</li>
        <li>Send it. Our team matches it to your request and replies here in My requests.</li>
      </ol>
      <a
        href={unboxingVideoLink(orderNo, refNo)}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#1f9d55] px-5 text-sm font-bold text-white transition-colors hover:bg-[#178246] sm:w-auto"
      >
        <WhatsApp className="size-5" /> Send video on WhatsApp
      </a>
      <p className="mt-2 text-[11.5px] text-ink-muted">Without the video we can&apos;t approve a refund or replacement.</p>
    </div>
  );
}
