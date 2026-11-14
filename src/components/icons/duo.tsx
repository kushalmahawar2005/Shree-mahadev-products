/**
 * Storefront feature icons: Phosphor "duotone" set, exported under the lucide names the code
 * already uses, so swapping an icon is just moving it from the `lucide-react` import to this one.
 *
 * Look: the outline takes the text colour (currentColor); the soft inner layer is recoloured to
 * brand mustard. Pass `mono` for faint watermark marks so the inner layer stays currentColor.
 *
 * Use these for content/feature icons (trust points, contact tiles, section marks, badges).
 * Keep plain lucide for small UI controls (arrows, chevrons, close, plus/minus, spinners, stars).
 *
 * Only the duotone artwork is bundled (duo-paths.ts, generated), so it works in server and client
 * components and doesn't ship Phosphor's other five weights to the browser.
 */
import { createElement } from "react";
import { DUO_PATHS } from "./duo-paths";
import { cn } from "@/lib/utils/cn";

/** Recolours Phosphor's duotone layer (the path carrying an `opacity` attribute) to mustard. */
const MUSTARD = "[&_path[opacity]]:fill-[#E0A526] [&_path[opacity]]:opacity-45";

export type DuoProps = Omit<React.SVGProps<SVGSVGElement>, "ref"> & {
  size?: number | string;
  mono?: boolean;
  /** Accessible title; without it the icon is decorative (aria-hidden). */
  alt?: string;
};
export type DuoIcon = React.FC<DuoProps>;

/** Phosphor duotone artwork (256 grid) drawn inline, see scripts/gen-duo-icons.mjs. */
function duo(phosphorName: string, name: string): DuoIcon {
  const els = DUO_PATHS[phosphorName];
  // size 24 by default, like lucide; a Tailwind size-* class still wins.
  function Duo({ mono, className, size = 24, alt, color = "currentColor", ...rest }: DuoProps) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 256 256"
        width={size}
        height={size}
        fill={color}
        aria-hidden={alt ? undefined : true}
        className={cn(!mono && MUSTARD, className)}
        {...rest}
      >
        {alt ? <title>{alt}</title> : null}
        {els.map(([tag, props], i) => createElement(tag, { key: i, ...props }))}
      </svg>
    );
  }
  Duo.displayName = `Duo${name}`;
  return Duo;
}

// Delivery, packs, places
export const Truck = duo("Truck", "Truck");
export const Package = duo("Package", "Package");
export const PackageCheck = duo("Package", "PackageCheck");
export const Boxes = duo("Cube", "Boxes");
export const Tin = duo("Cylinder", "Tin");
export const MapPin = duo("MapPin", "MapPin");
export const Store = duo("Storefront", "Store");
export const Factory = duo("Factory", "Factory");

// Purity, nature, proof
export const Leaf = duo("Leaf", "Leaf");
export const Sprout = duo("Plant", "Sprout");
export const Droplets = duo("Drop", "Droplets");
export const Wheat = duo("Grains", "Wheat");
export const Sun = duo("Sun", "Sun");
export const ShieldCheck = duo("ShieldCheck", "ShieldCheck");
export const BadgeCheck = duo("SealCheck", "BadgeCheck");
export const FlaskConical = duo("Flask", "FlaskConical");
export const FlaskConicalOff = duo("TestTube", "FlaskConicalOff");
export const FilterX = duo("FunnelSimpleX", "FilterX");
export const ThermometerSnowflake = duo("ThermometerCold", "ThermometerSnowflake");
export const Ban = duo("Prohibit", "Ban");
export const Hourglass = duo("Hourglass", "Hourglass");
export const Timer = duo("Timer", "Timer");
export const Palette = duo("Palette", "Palette");

// Kitchen uses
export const CookingPot = duo("CookingPot", "CookingPot");
export const Flame = duo("Fire", "Flame");
export const Cookie = duo("Cookie", "Cookie");
export const Baby = duo("Baby", "Baby");
export const Sparkles = duo("Sparkle", "Sparkles");
export const ChefHat = duo("ChefHat", "ChefHat");
export const Lightbulb = duo("Lightbulb", "Lightbulb");
export const BowlSteam = duo("BowlSteam", "BowlSteam");
export const Jar = duo("Jar", "Jar");
export const Lotus = duo("FlowerLotus", "Lotus");

// Contact, content
export const Phone = duo("Phone", "Phone");
export const Mail = duo("EnvelopeSimple", "Mail");
export const WhatsApp = duo("WhatsappLogo", "WhatsApp");
// Every storefront "chat" link opens WhatsApp, so the chat icon is the WhatsApp mark.
export const MessageCircle = duo("WhatsappLogo", "MessageCircle");
export const Clock = duo("Clock", "Clock");
export const CalendarDays = duo("CalendarBlank", "CalendarDays");
export const CalendarClock = duo("CalendarCheck", "CalendarClock");
export const BookOpen = duo("BookOpen", "BookOpen");
export const FileText = duo("FileText", "FileText");
export const PlayCircle = duo("PlayCircle", "PlayCircle");
export const Camera = duo("Camera", "Camera");
export const PenLine = duo("PencilSimpleLine", "PenLine");
export const UserRound = duo("User", "UserRound");

// Money, offers, status
export const Banknote = duo("Money", "Banknote");
export const CreditCard = duo("CreditCard", "CreditCard");
export const Lock = duo("Lock", "Lock");
export const BadgePercent = duo("SealPercent", "BadgePercent");
export const TicketPercent = duo("Ticket", "TicketPercent");
export const Zap = duo("Lightning", "Zap");
export const PartyPopper = duo("Confetti", "PartyPopper");
export const CheckCircle2 = duo("CheckCircle", "CheckCircle2");
export const AlertCircle = duo("WarningCircle", "AlertCircle");
export const XCircle = duo("XCircle", "XCircle");
