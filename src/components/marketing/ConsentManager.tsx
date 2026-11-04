"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { saveAttributionAction } from "@/lib/attribution-actions";
import { emitMarketingEvent, type MarketingEvent } from "@/lib/marketing-events";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
    clarity?: (...args: unknown[]) => void;
  }
}

const CONSENT_COOKIE = "smp_consent";
const ATTRIBUTION_COOKIE = "smp_attribution";
const gaId = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID ?? "";
const adsId = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID ?? "";
const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID ?? "";
const clarityId = process.env.NEXT_PUBLIC_CLARITY_ID ?? "";

type Attribution = {
  utm_source: string | null; utm_medium: string | null; utm_campaign: string | null;
  utm_content: string | null; utm_term: string | null; fbclid: string | null;
  fbc: string | null; fbp: string | null; gclid: string | null; client_id: string | null;
  landing_page: string | null; referrer: string | null; marketing_consent: boolean;
};
const emptyAttribution = (): Attribution => ({ utm_source:null,utm_medium:null,utm_campaign:null,utm_content:null,utm_term:null,fbclid:null,fbc:null,fbp:null,gclid:null,client_id:null,landing_page:null,referrer:null,marketing_consent:false });
const cookie = (name: string) => document.cookie.split("; ").find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1);
const readAttribution = (): Attribution => {
  try { return { ...emptyAttribution(), ...JSON.parse(decodeURIComponent(cookie(ATTRIBUTION_COOKIE) ?? "{}")) }; } catch { return emptyAttribution(); }
};
const writeCookie = (name: string, value: string) => { document.cookie = `${name}=${value}; Max-Age=7776000; Path=/; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`; };
const readClientId = () => {
  const raw = cookie("_ga");
  return raw ? raw.replace(/^GA\d+\.\d+\./, "").slice(0, 100) : null;
};
const publicUrl = (value: string) => {
  try { const u = new URL(value); return `${u.origin}${u.pathname}`.slice(0, 500); } catch { return null; }
};

function initialAttribution(): Attribution {
  const current = readAttribution();
  const query = new URLSearchParams(location.search);
  const hasSource = ["utm_source","utm_medium","utm_campaign","utm_content","utm_term","fbclid","gclid"].some((key) => query.has(key));
  if (!current.landing_page && hasSource) {
    current.utm_source = query.get("utm_source")?.slice(0,100) ?? null;
    current.utm_medium = query.get("utm_medium")?.slice(0,100) ?? null;
    current.utm_campaign = query.get("utm_campaign")?.slice(0,150) ?? null;
    current.utm_content = query.get("utm_content")?.slice(0,150) ?? null;
    current.utm_term = query.get("utm_term")?.slice(0,150) ?? null;
    current.fbclid = query.get("fbclid")?.slice(0,255) ?? null;
    current.gclid = query.get("gclid")?.slice(0,255) ?? null;
    current.fbc = current.fbclid ? `fb.1.${Date.now()}.${current.fbclid}` : null;
    current.landing_page = `${location.pathname}${query.has("size") ? `?size=${encodeURIComponent(query.get("size") ?? "")}` : ""}`.slice(0,500);
    current.referrer = publicUrl(document.referrer);
  }
  current.marketing_consent = cookie(CONSENT_COOKIE) === "all";
  if (current.marketing_consent) {
    current.fbp = cookie("_fbp") ?? current.fbp;
    current.fbc = cookie("_fbc") ?? current.fbc;
    current.client_id = readClientId();
  }
  return current;
}

const gaEventNames: Record<string, string> = {
  PageView: "page_view", ViewContent: "view_item", Search: "search", AddToCart: "add_to_cart",
  InitiateCheckout: "begin_checkout", AddPaymentInfo: "add_payment_info", Purchase: "purchase", Lead: "generate_lead", Contact: "contact",
};

export function ConsentManager() {
  const pathname = usePathname();
  const [choice, setChoice] = useState<"all" | "necessary" | null>(() => {
    if (typeof document === "undefined") return null;
    const value = cookie(CONSENT_COOKIE);
    return value === "all" || value === "necessary" ? value : null;
  });
  const persist = useCallback(async (next: Attribution) => {
    writeCookie(ATTRIBUTION_COOKIE, encodeURIComponent(JSON.stringify(next)));
    await saveAttributionAction(next);
  }, []);

  useEffect(() => {
    const a = initialAttribution();
    void persist(a);
    window.dataLayer = window.dataLayer ?? [];
    window.gtag = window.gtag ?? ((...args: unknown[]) => window.dataLayer?.push(args));
    window.gtag("consent", "default", { analytics_storage: "denied", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
  }, [persist]);

  useEffect(() => {
    if (choice !== "all") return;
    window.gtag?.("consent", "update", { analytics_storage: "granted", ad_storage: "granted", ad_user_data: "granted", ad_personalization: "granted" });
    window.gtag?.("event", "page_view", { page_location: location.href, page_title: document.title });
    if (pixelId) window.fbq?.("track", "PageView", {}, { eventID: crypto.randomUUID() });
  }, [choice, pathname]);

  useEffect(() => {
    if (choice !== "all") return;
    const onMarketing = (event: Event) => {
      const detail = (event as CustomEvent<MarketingEvent>).detail;
      const params = detail.params ?? {};
      if (pixelId && window.fbq) {
        const standard = ["PageView","ViewContent","Search","AddToCart","InitiateCheckout","AddPaymentInfo","Purchase"].includes(detail.name);
        window.fbq(standard ? "track" : "trackCustom", detail.name, params, { eventID: detail.eventId });
      }
      const gaName = gaEventNames[detail.name];
      if (gaName) window.gtag?.("event", gaName, { ...params, event_id: detail.eventId });
      if (detail.name === "Purchase" && adsId && process.env.NEXT_PUBLIC_GOOGLE_ADS_LABEL) {
        window.gtag?.("event", "conversion", { send_to: `${adsId}/${process.env.NEXT_PUBLIC_GOOGLE_ADS_LABEL}`, value: params.value, currency: "INR", transaction_id: detail.eventId });
      }
    };
    const onWhatsApp = (event: MouseEvent) => {
      if ((event.target as HTMLElement | null)?.closest("a[href*='wa.me'],a[href*='whatsapp.com']")) emitMarketingEvent("Contact", { method: "whatsapp" });
    };
    window.addEventListener("smp:marketing-event", onMarketing);
    document.addEventListener("click", onWhatsApp);
    return () => { window.removeEventListener("smp:marketing-event", onMarketing); document.removeEventListener("click", onWhatsApp); };
  }, [choice]);

  async function choose(value: "all" | "necessary") {
    writeCookie(CONSENT_COOKIE, value);
    setChoice(value);
    const a = initialAttribution();
    a.marketing_consent = value === "all";
    if (a.marketing_consent) { a.fbp = cookie("_fbp") ?? a.fbp; a.fbc = cookie("_fbc") ?? a.fbc; a.client_id = readClientId(); }
    await persist(a);
  }

  return <>
    {choice === "all" && <>
      {(gaId || adsId) && <>
        <Script src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId || adsId)}`} strategy="afterInteractive" />
        <Script id="smp-gtag-init" strategy="afterInteractive">{`window.dataLayer=window.dataLayer||[];window.gtag=function(){dataLayer.push(arguments)};gtag('js',new Date());gtag('consent','update',{analytics_storage:'granted',ad_storage:'granted',ad_user_data:'granted',ad_personalization:'granted'});${gaId ? `gtag('config','${gaId}',{send_page_view:false});` : ""}${adsId ? `gtag('config','${adsId}');` : ""}`}</Script>
      </>}
      {pixelId && <Script id="smp-meta-pixel" strategy="afterInteractive">{`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${pixelId}');`}</Script>}
      {clarityId && <Script id="smp-clarity" strategy="afterInteractive">{`(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src='https://www.clarity.ms/tag/'+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y)})(window,document,'clarity','script','${clarityId}');`}</Script>}
    </>}
    {choice === null && <aside aria-label="Privacy choices" className="fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-[70] mx-auto max-w-3xl rounded-2xl border border-line bg-white p-4 shadow-xl md:bottom-4 md:flex md:items-center md:gap-5 md:p-5">
      <p className="flex-1 text-sm leading-relaxed text-ink-muted">We use optional analytics and advertising tools to understand visits and measure campaigns. You can change your choice at any time.</p>
      <div className="mt-3 flex shrink-0 gap-2 md:mt-0">
        <button type="button" onClick={() => void choose("necessary")} className="min-h-11 flex-1 rounded-full border border-line px-4 text-sm font-semibold text-forest md:flex-none">Only necessary</button>
        <button type="button" onClick={() => void choose("all")} className="min-h-11 flex-1 rounded-full bg-forest px-4 text-sm font-semibold text-white hover:bg-forest-mid md:flex-none">Accept all</button>
      </div>
    </aside>}
  </>;
}
