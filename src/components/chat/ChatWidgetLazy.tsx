"use client";

import dynamic from "next/dynamic";
import { useIdleReady } from "@/hooks/use-idle-ready";

// The assistant (chat UI, blocks, zod, voice) is ~300 KB of JS. It loads after the page is
// interactive and the browser is idle, so it never competes with the hero image or first paint.
const ChatWidget = dynamic(() => import("./ChatWidget").then((m) => m.ChatWidget), { ssr: false });

export function ChatWidgetLazy() {
  return useIdleReady() ? <ChatWidget /> : null;
}
