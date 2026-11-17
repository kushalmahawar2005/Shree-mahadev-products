"use client";

import { motion } from "motion/react";
import { CircleHelp, MessagesSquare, Package, Store } from "lucide-react";
import { spring } from "@/components/chat/motion";

export type ChatTab = "chat" | "shop" | "orders" | "help";
const TABS: { id: ChatTab; label: string; icon: typeof Store }[] = [
  { id: "chat", label: "Chat", icon: MessagesSquare },
  { id: "shop", label: "Shop", icon: Store },
  { id: "orders", label: "Orders", icon: Package },
  { id: "help", label: "Help", icon: CircleHelp },
];

/** Four views of the assistant: quiet labels, a 2px green underline slides under the active one. */
export function ChatTabBar({ tab, onChange, className = "" }: { tab: ChatTab; onChange: (tab: ChatTab) => void; className?: string }) {
  return (
    <div role="tablist" aria-label="Assistant sections" className={`grid grid-cols-4 ${className}`}>
      {TABS.map(({ id, label, icon: Icon }) => {
        const active = id === tab;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            id={`chat-tab-${id}`}
            aria-selected={active}
            aria-controls="chat-tab-panel"
            onClick={() => onChange(id)}
            className={`relative flex h-11 items-center justify-center gap-1.5 text-[13px] font-medium transition-colors ${active ? "text-forest" : "text-ink-muted hover:text-ink"}`}
          >
            <Icon size={16} />
            {label}
            {active && <motion.span layoutId="chat-tab-indicator" transition={spring.panel} className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-forest" />}
          </button>
        );
      })}
    </div>
  );
}
