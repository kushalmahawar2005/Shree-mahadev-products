"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowUpRight, Phone, RotateCcw } from "lucide-react";
import * as Duo from "@/components/icons/duo";
import { RichText } from "@/components/chat/ChatParts";
import { rise, staggerParent, tap } from "@/components/chat/motion";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/shadcn/accordion";
import { site, whatsappLink } from "@/data/site";

type HelpData = {
  faqs: { id: string; category: string; question: string; answer: string }[];
  policies: { title: string; href: string }[];
  reports: { name: string; reportNo: string; href: string }[];
};
const GROUPS: { id: string; label: string }[] = [
  { id: "orders", label: "Orders aur delivery" },
  { id: "payments", label: "Payment" },
  { id: "returns", label: "Return aur refund" },
  { id: "products", label: "Products" },
];
const label = "mb-2 px-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted";

/** Help tab: FAQ accordion, policies, lab reports and a direct line to the team. */
export default function HelpTab({ onAsk }: { onAsk: (text: string) => void }) {
  const [data, setData] = useState<HelpData | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    fetch("/api/chat/help")
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
      .then((value: HelpData) => { if (alive) { setData(value); setFailed(false); } })
      .catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, [attempt]);

  return (
    <motion.div initial="hidden" animate="show" variants={staggerParent(0.05)} className="space-y-4 px-3.5 py-3.5">
      <motion.div variants={rise} className="grid grid-cols-2 gap-2">
        <motion.a {...tap} href={whatsappLink("Namaste, mujhe madad chahiye.")} target="_blank" rel="noreferrer" className="flex min-h-14 items-center gap-2.5 rounded-2xl border border-line bg-white px-3 shadow-[0_1px_2px_rgba(0,0,0,.04)]">
          <Duo.WhatsApp size={26} /><span><span className="block text-sm font-semibold text-ink">WhatsApp</span><span className="block text-[12.5px] text-ink-muted">Team se baat</span></span>
        </motion.a>
        <motion.a {...tap} href={site.phoneHref} className="flex min-h-14 items-center gap-2.5 rounded-2xl border border-line bg-white px-3 shadow-[0_1px_2px_rgba(0,0,0,.04)]">
          <Phone size={22} className="text-forest" /><span><span className="block text-sm font-semibold text-ink">Call</span><span className="block text-[12.5px] text-ink-muted">{site.supportHours}</span></span>
        </motion.a>
      </motion.div>

      {failed ? (
        <div className="rounded-2xl border border-warm-line bg-warm p-4 text-sm text-ink">
          Help load nahi ho paaya.
          <button type="button" onClick={() => setAttempt((value) => value + 1)} className="ml-2 inline-flex items-center gap-1 font-semibold text-forest underline underline-offset-2"><RotateCcw size={13} />Dobara try karein</button>
        </div>
      ) : !data ? (
        <div className="space-y-2">{[0, 1, 2, 3].map((item) => <div key={item} className="h-12 animate-pulse rounded-xl bg-co-panel" />)}</div>
      ) : (
        <>
          {GROUPS.map((group) => {
            const items = data.faqs.filter((faq) => faq.category === group.id);
            if (!items.length) return null;
            return (
              <motion.section key={group.id} variants={rise}>
                <p className={label}>{group.label}</p>
                <Accordion type="single" collapsible className="overflow-hidden rounded-2xl border border-line bg-white">
                  {items.map((faq) => (
                    <AccordionItem key={faq.id} value={faq.id} className="border-line px-3.5 last:border-b-0">
                      <AccordionTrigger className="min-h-11 py-3 text-left text-sm font-semibold text-ink hover:no-underline">{faq.question}</AccordionTrigger>
                      <AccordionContent className="text-[14px] leading-normal text-ink-muted">
                        <RichText text={faq.answer.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")} />
                        <button type="button" onClick={() => onAsk(faq.question)} className="mt-2 text-[12.5px] font-semibold text-forest underline underline-offset-2">Isse aur poochein</button>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </motion.section>
            );
          })}

          <motion.section variants={rise}>
            <p className={label}>Lab reports</p>
            <div className="flex flex-wrap gap-1.5">
              {data.reports.map((report) => (
                <Link key={report.reportNo} href={report.href} className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-line bg-white px-3 text-[13px] font-medium text-ink hover:border-forest/30 hover:text-forest">
                  <Duo.FlaskConical size={18} />{report.name}
                </Link>
              ))}
            </div>
          </motion.section>

          <motion.section variants={rise}>
            <p className={label}>Policies</p>
            <ul className="overflow-hidden rounded-2xl border border-line bg-white">
              {data.policies.map((policy, index) => (
                <li key={policy.href} className={index ? "border-t border-line" : ""}>
                  <Link href={policy.href} className="flex min-h-11 items-center justify-between px-3.5 text-sm font-medium text-ink hover:text-forest">{policy.title}<ArrowUpRight size={15} className="text-ink-muted" /></Link>
                </li>
              ))}
            </ul>
          </motion.section>
        </>
      )}

      <p className="text-center text-[11px] text-ink-muted">AI jawab store ki jaankari se aate hain, kabhi galti ho sakti hai.</p>
    </motion.div>
  );
}
