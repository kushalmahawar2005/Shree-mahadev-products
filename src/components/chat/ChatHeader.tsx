"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";
import { Check, Languages, MessageCircle, MoreHorizontal, Package, RotateCcw, ShoppingBag, X } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "@/components/shadcn/dropdown-menu";
import { ease, spring } from "@/components/chat/motion";
import { whatsappLink } from "@/data/site";

export type ChatLanguage = "auto" | "English" | "Hinglish" | "Hindi";
const LANGUAGES: { value: ChatLanguage; label: string }[] = [
  { value: "auto", label: "Auto (jaise aap likhein)" },
  { value: "Hinglish", label: "Hinglish" },
  { value: "Hindi", label: "हिंदी" },
  { value: "English", label: "English" },
];

const iconBtn = "grid size-11 place-items-center rounded-full text-white/85 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-mustard";

/** 64px header: identity on the left; cart, menu and close on the right. */
export function ChatHeader({ cartCount, language, onCart, onNewChat, onLanguage, onOrders, onClose }: {
  cartCount: number;
  language: ChatLanguage;
  onCart: () => void;
  onNewChat: () => void;
  onLanguage: (value: ChatLanguage) => void;
  onOrders: () => void;
  onClose: () => void;
}) {
  return (
    <header className="relative flex h-16 shrink-0 items-center justify-between overflow-hidden bg-[linear-gradient(135deg,var(--color-forest)_0%,#0b3b23_100%)] pl-3.5 pr-1.5 text-white">
      <div aria-hidden className="pointer-events-none absolute -right-12 -top-20 size-48 rounded-full bg-mustard/25 blur-3xl" />
      <div className="relative flex min-w-0 items-center gap-2.5">
        <span className="relative grid size-10 shrink-0 place-items-center rounded-full bg-white shadow-sm">
          <Image src="/logo.png" alt="" width={36} height={36} className="size-8 object-contain" />
          <span className="absolute -bottom-0.5 -right-0.5 grid size-3 place-items-center" aria-hidden>
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400/70 motion-reduce:hidden" />
            <span className="relative size-3 rounded-full bg-emerald-400 ring-2 ring-forest" />
          </span>
        </span>
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-base font-semibold leading-tight">
            Mahadev Sahayak
            <span className="rounded-full bg-mustard/90 px-1.5 text-[11px] font-bold uppercase leading-[18px] tracking-[0.08em] text-forest">AI</span>
          </p>
          <p className="truncate text-[12.5px] text-white/70">Your Personal Assistant · Online</p>
        </div>
      </div>

      <div className="relative flex items-center">
        <button type="button" onClick={onCart} aria-label={`Cart, ${cartCount} item${cartCount === 1 ? "" : "s"}`} className={`${iconBtn} relative`} data-chat-cart-target>
          <ShoppingBag size={19} />
          <AnimatePresence>
            {cartCount > 0 && (
              <motion.span
                key={cartCount}
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: [1.35, 1], opacity: 1, transition: spring.press }}
                exit={{ scale: 0.4, opacity: 0, transition: { duration: 0.12, ease: ease.inQuart } }}
                className="absolute right-1 top-1 grid min-w-[18px] place-items-center rounded-full bg-mustard px-1 text-[11px] font-bold leading-[18px] text-forest tabular-nums"
              >
                {cartCount}
              </motion.span>
            )}
          </AnimatePresence>
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" aria-label="More options" className={iconBtn}><MoreHorizontal size={20} /></button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={6} data-chat-keep className="z-[95] w-56 rounded-xl">
            <DropdownMenuItem onSelect={onNewChat} className="h-10 gap-2"><RotateCcw className="size-4" />Naya chat</DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="h-10 gap-2"><Languages className="size-4" />Bhasha / Language</DropdownMenuSubTrigger>
              <DropdownMenuSubContent data-chat-keep className="z-[96] rounded-xl">
                {LANGUAGES.map((item) => (
                  <DropdownMenuItem key={item.value} onSelect={() => onLanguage(item.value)} className="h-10 justify-between gap-3">
                    {item.label}{language === item.value && <Check className="size-4 text-forest" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuItem onSelect={onOrders} className="h-10 gap-2"><Package className="size-4" />Mere orders</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="h-10 gap-2">
              <a href={whatsappLink("Namaste, mujhe madad chahiye.")} target="_blank" rel="noreferrer"><MessageCircle className="size-4" />WhatsApp support</a>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <button type="button" onClick={onClose} aria-label="Close chat" className={iconBtn}><X size={21} /></button>
      </div>
    </header>
  );
}
